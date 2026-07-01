/**
 * RCM R3 · Claim scrubber.
 *
 * Deterministic, idempotent (safe for bulk re-run). Reuses the existing
 * `validateClaimRcmReadiness` (which owns AUTH_MISSING coverage) and adds the
 * R3-native blocker set: ELIG_INVALID, ICD_MISSING, PRICE_STALE,
 * DRG_UNGROUPED, CHARGE_ZERO, COVERAGE_EXPIRED, SIG_MISSING.
 *
 * Output shape mirrors the MDS validator so panels can render both together.
 */
import { loadClaimReadinessBundle, type ReadinessBundle } from "@/lib/mds/claim-loader";
import { validateClaimRcmReadiness } from "@/lib/rcm/validation";
import { bucketOfClaim, type ClaimStatus } from "@/lib/rcm/claim-sm";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ScrubSeverity = "blocker" | "warning" | "info";
export type ScrubBlocker = {
  code: string;
  severity: ScrubSeverity;
  category: string;
  message: string;
  fix_hint?: string;
  deep_link?: string;
};
export type ScrubResult = {
  claim_id: string;
  ok: boolean;
  blockers: ScrubBlocker[];
  warnings: ScrubBlocker[];
  next_status: ClaimStatus;   // recommendation only; state-machine decides
  hash: string;               // stable across identical input
  ran_at: string;
};

function stableStringify(v: unknown): string {
  return JSON.stringify(v, Object.keys(v as object ?? {}).sort());
}
function hashArray(arr: unknown[]): string {
  // FNV-1a 32-bit — cheap, deterministic, no crypto import needed at edge.
  const s = arr.map(stableStringify).join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function push(list: ScrubBlocker[], b: ScrubBlocker) { list.push(b); }

function encounterDeepLink(encId?: string | null) {
  return encId ? `/clinical?tab=encounters&encounter=${encId}` : undefined;
}
function elgDeepLink(veId?: string | null) {
  return veId ? `/clinical?tab=rcm-eligibility&ve=${veId}` : "/clinical?tab=rcm-eligibility";
}
function authDeepLink(encId?: string | null) {
  return encId ? `/clinical?tab=rcm-authorization&encounter=${encId}` : "/clinical?tab=rcm-authorization";
}
function codingDeepLink(encId?: string | null) {
  return encId ? `/clinical?tab=coding&encounter=${encId}` : "/clinical?tab=coding";
}

/**
 * Run all R3 blockers against a loaded bundle. Pure — no DB writes.
 */
export function scrubBundle(bundle: ReadinessBundle): Omit<ScrubResult, "claim_id" | "ran_at"> {
  const blockers: ScrubBlocker[] = [];
  const warnings: ScrubBlocker[] = [];

  const claim = bundle.claim ?? {};
  const enc = bundle.encounter ?? {};
  const items = bundle.claimItems ?? [];
  const isCash = String(claim.claim_type ?? "").toLowerCase() === "cash";
  const isDrg = String(claim.billing_model) === "drg_bundled";

  // ELIG_INVALID — insured claim requires a linked coverage + non-expired policy.
  if (!isCash) {
    if (!claim.coverage_id) {
      push(blockers, {
        code: "ELIG_INVALID", severity: "blocker", category: "eligibility",
        message: "Insured claim has no coverage linked.",
        fix_hint: "Attach a coverage from the Eligibility worklist.",
        deep_link: elgDeepLink(),
      });
    }
    const ve = (bundle as any).visitEligibility as { id?: string; status?: string } | undefined;
    if (ve && ve.status && ve.status !== "insured") {
      push(blockers, {
        code: "ELIG_INVALID", severity: "blocker", category: "eligibility",
        message: `Visit eligibility is '${ve.status}' — must be 'insured' before submission.`,
        deep_link: elgDeepLink(ve.id ?? null),
      });
    }
  }

  // COVERAGE_EXPIRED — coverage row exists but period_end < today.
  const cov = (bundle as any).coverage as { period_end?: string | null } | undefined;
  if (cov?.period_end) {
    const end = new Date(cov.period_end).getTime();
    if (Number.isFinite(end) && end < Date.now()) {
      push(blockers, {
        code: "COVERAGE_EXPIRED", severity: "blocker", category: "eligibility",
        message: `Coverage expired on ${cov.period_end}.`,
        deep_link: elgDeepLink(),
      });
    }
  }

  // ICD_MISSING — no principal diagnosis on the encounter.
  const hasPrincipal = (bundle.diagnoses ?? []).some((d: any) => d.role === "principal");
  if (!hasPrincipal) {
    push(blockers, {
      code: "ICD_MISSING", severity: "blocker", category: "coding",
      message: "Principal ICD-10-AM diagnosis is missing on the encounter.",
      fix_hint: "Add a principal diagnosis in the Encounter pane.",
      deep_link: encounterDeepLink(enc.id),
    });
  }

  // DRG_UNGROUPED — inpatient / DRG-bundled claims require an assigned DRG.
  if (isDrg && !bundle.drgAssignment) {
    push(blockers, {
      code: "DRG_UNGROUPED", severity: "blocker", category: "coding",
      message: "Inpatient claim is not grouped — run the DRG grouper.",
      deep_link: codingDeepLink(enc.id),
    });
  }

  // CHARGE_ZERO — non-DRG claims must have at least one priced item and non-zero net.
  if (!isDrg) {
    if (items.length === 0) {
      push(blockers, {
        code: "CHARGE_ZERO", severity: "blocker", category: "pricing",
        message: "Claim has no priced items.",
        deep_link: codingDeepLink(enc.id),
      });
    } else if ((claim.total_net_minor ?? 0) <= 0) {
      push(blockers, {
        code: "CHARGE_ZERO", severity: "blocker", category: "pricing",
        message: "Claim total is zero — verify pricing.",
        deep_link: codingDeepLink(enc.id),
      });
    }
  }

  // PRICE_STALE — pricing_trace older than 24h vs updated_at signals a re-price is needed.
  const trace = claim.pricing_trace as { priced_at?: string } | null | undefined;
  if (trace?.priced_at && claim.updated_at) {
    const priced = new Date(trace.priced_at).getTime();
    const upd = new Date(claim.updated_at).getTime();
    if (Number.isFinite(priced) && Number.isFinite(upd) && (upd - priced) > 24 * 60 * 60 * 1000) {
      push(warnings, {
        code: "PRICE_STALE", severity: "warning", category: "pricing",
        message: "Pricing snapshot is older than 24 hours since last claim change — consider re-assembling.",
      });
    }
  } else if (!trace?.priced_at && items.length > 0) {
    push(warnings, {
      code: "PRICE_STALE", severity: "warning", category: "pricing",
      message: "No pricing trace recorded on the claim snapshot.",
    });
  }

  // SIG_MISSING — attending clinician signature (encounter_care_team primary attending) required.
  const team = (bundle as any).careTeam as any[] | undefined;
  const hasAttending = Array.isArray(team) && team.some((t) => String(t.role ?? "").toLowerCase().includes("attending"));
  if (!hasAttending) {
    push(warnings, {
      code: "SIG_MISSING", severity: "warning", category: "documentation",
      message: "No attending clinician recorded on encounter care team.",
      deep_link: encounterDeepLink(enc.id),
    });
  }

  // Reuse existing validator — pulls AUTH_MISSING, eligibility lifecycle, snapshot drift.
  const legacy = validateClaimRcmReadiness(bundle);
  for (const m of legacy.missing) {
    const rec: ScrubBlocker = {
      code: m.code,
      severity: m.severity === "warning" ? "warning" : "blocker",
      category: m.category,
      message: m.message,
      deep_link:
        m.category === "authorization" ? authDeepLink(enc.id)
        : m.category === "eligibility" ? elgDeepLink()
        : undefined,
    };
    (rec.severity === "warning" ? warnings : blockers).push(rec);
  }

  // Recommend next status
  const hasAuth = blockers.some((b) => b.code === "AUTH_MISSING");
  const hasCoding = blockers.some((b) => b.code === "ICD_MISSING" || b.code === "DRG_UNGROUPED");
  const next_status: ClaimStatus =
    blockers.length === 0 ? "ready"
    : hasAuth ? "auth_hold"
    : hasCoding ? "coding_hold"
    : "scrub_failed";

  const hash = hashArray([...blockers, ...warnings, next_status]);
  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    next_status,
    hash,
  };
}

export async function scrubClaimById(
  claimId: string,
  tenantId: string,
): Promise<{ ok: true; result: ScrubResult; bundle: ReadinessBundle } | { ok: false; error: string }> {
  const b = await loadClaimReadinessBundle(claimId, tenantId);
  if (!b.ok) return { ok: false, error: b.reason };
  const r = scrubBundle(b.bundle);
  return { ok: true, result: { ...r, claim_id: claimId, ran_at: new Date().toISOString() }, bundle: b.bundle };
}

export const CLAIM_BUCKET_FROM_STATUS = bucketOfClaim; // re-export for panes