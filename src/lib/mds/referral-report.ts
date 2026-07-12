/**
 * Step 5 · Turn 3 — Referral Report (HCA-1010) pure aggregator.
 *
 * Consumes two flat arrays (`referral` + `referral_target` joined by
 * `referral_id`) and computes the report shape shared by the JSON and
 * CSV endpoints. Keeping the aggregator pure lets the CSV row list and
 * the JSON summary stay in lockstep, and lets tests exercise the math
 * without a mock DB round-trip.
 *
 * Cluster scope classification (per target) is derived from the parent
 * `referral.referral_class`:
 *   external       → 'external'
 *   inter_company  → 'sibling'
 *   otherwise      → 'own'
 *
 * TAT (turnaround, hours): created_at → target.updated_at when the
 * target has moved out of 'draft'; null otherwise. Documented assumption;
 * an audit-log source can replace this later without changing the shape.
 */

export const REPORT_SCAN_CAP = 5000;

export type ReferralInput = {
  id: string;
  referral_no: string;
  created_at: string;
  source_specialty: string | null;
  referral_class: string;
  status: string;
  reason: string | null;
  source_key: string | null;
  charge_mode: string | null;
  preauth_required: boolean | null;
  series_id: string | null;
};

export type TargetInput = {
  id: string;
  referral_id: string;
  target_kind: string;
  target_specialty: string | null;
  target_facility_id: string | null;
  status: string;
  updated_at: string | null;
  created_at: string | null;
};

export type ClusterScope = "own" | "sibling" | "external";

export type ReportRow = {
  referral_id: string;
  referral_no: string;
  created_at: string;
  source_specialty: string | null;
  referral_class: string;
  referral_status: string;
  source_key: string | null;
  target_id: string;
  target_kind: string;
  target_specialty: string | null;
  target_facility_id: string | null;
  cluster_scope: ClusterScope;
  target_status: string;
  decision_at: string | null;
  tat_hours: number | null;
  charge_mode: string | null;
  preauth_required: boolean;
  decline_reason: string | null;
};

export type ReportFilters = {
  date_from: string;
  date_to: string;
  source_specialty: string | null;
  target_kind: string | null;
  cluster_scope: ClusterScope | "all";
};

export type ReportSummary = {
  filters: ReportFilters;
  totals: {
    rows: number;
    referrals: number;
    accepted: number;
    declined: number;
    cancelled: number;
    completed: number;
    submitted: number;
    draft: number;
  };
  acceptance_rate: number;
  external_blocked_share: number;
  tat: { mean_hours: number | null; p90_hours: number | null };
  by_source: Array<{ source_specialty: string; count: number }>;
  by_target: Array<{ target_kind: string; target_specialty: string | null; count: number }>;
  by_status: Array<{ status: string; count: number }>;
  cluster_split: { own: number; sibling: number; external: number };
  series_split: { series: number; single: number };
  decline_reasons: Array<{ reason: string; count: number }>;
  truncated: boolean;
};

function classifyCluster(referral_class: string): ClusterScope {
  if (referral_class === "external") return "external";
  if (referral_class === "inter_company") return "sibling";
  return "own";
}

function hoursBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}

function p90(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
  return sorted[idx];
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Join referral + targets into a flat row list already filtered by the
 * given ReportFilters. Sorted by created_at desc for stable CSV output.
 */
export function buildRows(
  referrals: ReferralInput[],
  targets: TargetInput[],
  filters: ReportFilters,
): ReportRow[] {
  const byId = new Map<string, ReferralInput>();
  for (const r of referrals) byId.set(r.id, r);

  const rows: ReportRow[] = [];
  for (const t of targets) {
    const r = byId.get(t.referral_id);
    if (!r) continue;
    if (r.created_at < filters.date_from) continue;
    if (r.created_at > filters.date_to) continue;
    if (filters.source_specialty && r.source_specialty !== filters.source_specialty) continue;
    if (filters.target_kind && t.target_kind !== filters.target_kind) continue;

    const cluster = classifyCluster(r.referral_class);
    if (filters.cluster_scope !== "all" && cluster !== filters.cluster_scope) continue;

    const movedOut = t.status !== "draft" && !!t.updated_at;
    const decision_at = movedOut ? t.updated_at : null;
    const tat_hours = movedOut && decision_at
      ? Math.max(0, hoursBetween(r.created_at, decision_at))
      : null;

    rows.push({
      referral_id: r.id,
      referral_no: r.referral_no,
      created_at: r.created_at,
      source_specialty: r.source_specialty,
      referral_class: r.referral_class,
      referral_status: r.status,
      source_key: r.source_key,
      target_id: t.id,
      target_kind: t.target_kind,
      target_specialty: t.target_specialty,
      target_facility_id: t.target_facility_id,
      cluster_scope: cluster,
      target_status: t.status,
      decision_at,
      tat_hours: tat_hours != null ? Math.round(tat_hours * 10) / 10 : null,
      charge_mode: r.charge_mode,
      preauth_required: !!r.preauth_required,
      decline_reason: t.status === "declined" ? (r.reason ?? null) : null,
    });
  }
  rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return rows;
}

export function summarise(rows: ReportRow[], filters: ReportFilters, truncated: boolean): ReportSummary {
  const referralIds = new Set<string>();
  const bySource = new Map<string, number>();
  const byTarget = new Map<string, { target_kind: string; target_specialty: string | null; count: number }>();
  const byStatus = new Map<string, number>();
  const cluster = { own: 0, sibling: 0, external: 0 };
  const declineReasons = new Map<string, number>();
  const tatValues: number[] = [];
  let series = 0, single = 0, externalBlocked = 0;
  const totals = { rows: rows.length, referrals: 0, accepted: 0, declined: 0, cancelled: 0, completed: 0, submitted: 0, draft: 0 };

  for (const row of rows) {
    referralIds.add(row.referral_id);
    const src = row.source_specialty ?? "(unset)";
    bySource.set(src, (bySource.get(src) ?? 0) + 1);
    const tkey = `${row.target_kind}:${row.target_specialty ?? ""}`;
    const bucket = byTarget.get(tkey);
    if (bucket) bucket.count++;
    else byTarget.set(tkey, { target_kind: row.target_kind, target_specialty: row.target_specialty, count: 1 });

    byStatus.set(row.target_status, (byStatus.get(row.target_status) ?? 0) + 1);
    cluster[row.cluster_scope]++;
    if (row.cluster_scope === "external") externalBlocked++;

    if (row.tat_hours != null) tatValues.push(row.tat_hours);
    if (row.decline_reason) {
      declineReasons.set(row.decline_reason, (declineReasons.get(row.decline_reason) ?? 0) + 1);
    }

    // per-target status contributes to totals
    if (row.target_status === "accepted") totals.accepted++;
    else if (row.target_status === "declined") totals.declined++;
    else if (row.target_status === "cancelled") totals.cancelled++;
    else if (row.target_status === "completed") totals.completed++;
    else if (row.target_status === "submitted") totals.submitted++;
    else if (row.target_status === "draft") totals.draft++;
  }

  // Series vs single: per-referral bucket (source_key prefix or referral_class heuristic).
  const referralsSeen = new Set<string>();
  for (const row of rows) {
    if (referralsSeen.has(row.referral_id)) continue;
    referralsSeen.add(row.referral_id);
    const looksSeries = (row.source_key ?? "").startsWith("series:") || row.target_kind === "series";
    if (looksSeries) series++;
    else single++;
  }

  totals.referrals = referralIds.size;
  const decided = totals.accepted + totals.declined + totals.cancelled + totals.completed;
  const acceptance_rate = decided > 0 ? (totals.accepted + totals.completed) / decided : 0;
  const external_blocked_share = totals.rows > 0 ? externalBlocked / totals.rows : 0;

  const by_source = [...bySource.entries()]
    .map(([source_specialty, count]) => ({ source_specialty, count }))
    .sort((a, b) => b.count - a.count);
  const by_target = [...byTarget.values()].sort((a, b) => b.count - a.count);
  const by_status = [...byStatus.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
  const decline_reasons = [...declineReasons.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return {
    filters,
    totals,
    acceptance_rate: Math.round(acceptance_rate * 1000) / 1000,
    external_blocked_share: Math.round(external_blocked_share * 1000) / 1000,
    tat: {
      mean_hours: mean(tatValues) != null ? Math.round((mean(tatValues) as number) * 10) / 10 : null,
      p90_hours: p90(tatValues),
    },
    by_source,
    by_target,
    by_status,
    cluster_split: cluster,
    series_split: { series, single },
    decline_reasons,
    truncated,
  };
}

/**
 * RFC 4180-ish CSV row escape: wrap in quotes when the cell contains
 * comma, quote, CR, or LF; escape internal quotes by doubling.
 */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const CSV_COLUMNS: Array<{ key: keyof ReportRow; header: string }> = [
  { key: "referral_no", header: "referral_no" },
  { key: "created_at", header: "created_at" },
  { key: "source_specialty", header: "source_specialty" },
  { key: "referral_class", header: "referral_class" },
  { key: "referral_status", header: "referral_status" },
  { key: "target_kind", header: "target_kind" },
  { key: "target_specialty", header: "target_specialty" },
  { key: "target_facility_id", header: "target_facility_id" },
  { key: "cluster_scope", header: "cluster_scope" },
  { key: "target_status", header: "target_status" },
  { key: "decision_at", header: "decision_at" },
  { key: "tat_hours", header: "tat_hours" },
  { key: "charge_mode", header: "charge_mode" },
  { key: "preauth_required", header: "preauth_required" },
  { key: "source_key", header: "source_key" },
];

export function toCsv(rows: ReportRow[]): string {
  const lines = [CSV_COLUMNS.map((c) => c.header).join(",")];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((c) => csvCell(row[c.key])).join(","));
  }
  return lines.join("\n") + "\n";
}

export function parseFilters(sp: URLSearchParams): ReportFilters {
  const now = new Date();
  const defTo = now.toISOString();
  const defFrom = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
  const cs = (sp.get("cluster_scope") ?? "all") as ReportFilters["cluster_scope"];
  const allowed = new Set(["own", "sibling", "external", "all"]);
  return {
    date_from: sp.get("date_from") ?? defFrom,
    date_to: sp.get("date_to") ?? defTo,
    source_specialty: sp.get("source_specialty"),
    target_kind: sp.get("target_kind"),
    cluster_scope: allowed.has(cs) ? cs : "all",
  };
}