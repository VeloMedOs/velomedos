/**
 * Phase 9 — write parsed NPHIES ClaimResponse back into claim + claim_item.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ParsedClaimResponse } from "./fhir/claim-response";

export type ReconcileResult = {
  outcome: "complete" | "partial" | "error";
  mismatches: { sequence: number; expectedNet: number; adjudicatedNet: number }[];
  totals: { payerMinor: number; patientMinor: number; netMinor: number };
};

export async function reconcileClaim(
  db: any,
  claimId: string,
  parsed: ParsedClaimResponse,
): Promise<ReconcileResult> {
  const { data: claim } = await db.from("claim").select("*").eq("id", claimId).maybeSingle();
  if (!claim) throw new Error("claim_not_found");

  const mismatches: ReconcileResult["mismatches"] = [];

  if (claim.billing_model === "itemized_sbs") {
    const { data: items } = await db
      .from("claim_item")
      .select("id, sequence_no, net_minor")
      .eq("claim_id", claimId)
      .order("sequence_no");
    const bySeq = new Map<number, any>();
    (items ?? []).forEach((i: any) => bySeq.set(i.sequence_no, i));

    for (const p of parsed.items) {
      const it = bySeq.get(p.sequence);
      if (!it) continue;
      if (Number(it.net_minor) !== p.netMinor) {
        mismatches.push({
          sequence: p.sequence,
          expectedNet: Number(it.net_minor),
          adjudicatedNet: p.netMinor,
        });
      }
      await db
        .from("claim_item")
        .update({
          adjudicated_payer_share_minor: p.payerMinor,
          adjudicated_patient_share_minor: p.patientMinor,
          adjudicated_net_minor: p.netMinor,
          adjudication_reason: p.reason ?? null,
        })
        .eq("id", it.id);
    }
  } else {
    // DRG bundled — single bundle line gets the adjudicated DRG amount.
    const { data: items } = await db
      .from("claim_item")
      .select("id")
      .eq("claim_id", claimId)
      .order("sequence_no");
    const first = items?.[0];
    if (first) {
      await db
        .from("claim_item")
        .update({
          adjudicated_payer_share_minor: parsed.totals.payerMinor,
          adjudicated_patient_share_minor: parsed.totals.patientMinor,
          adjudicated_net_minor: parsed.totals.netMinor,
        })
        .eq("id", first.id);
    }
    if (Number(claim.total_net_minor) !== parsed.totals.netMinor) {
      mismatches.push({
        sequence: 1,
        expectedNet: Number(claim.total_net_minor),
        adjudicatedNet: parsed.totals.netMinor,
      });
    }
  }

  const outcome: ReconcileResult["outcome"] =
    parsed.outcome === "error"
      ? "error"
      : mismatches.length || parsed.outcome === "partial"
      ? "partial"
      : "complete";

  return { outcome, mismatches, totals: parsed.totals };
}