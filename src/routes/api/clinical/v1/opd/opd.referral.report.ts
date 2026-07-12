/**
 * Step 5 · Turn 3 — Referral report (HCA-1010) JSON endpoint.
 *
 * Tenant-scoped aggregation over referral + referral_target. Reuses the
 * pure aggregator in `@/lib/mds/referral-report` so the CSV export
 * cannot drift. Read-only.
 */
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import type { ClinicalRole } from "@/lib/clinical-role-matrix";
import {
  buildRows, summarise, parseFilters,
  REPORT_SCAN_CAP,
  type ReferralInput, type TargetInput,
} from "@/lib/mds/referral-report";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ReportCtx = { tenantId: string; userId: string; clinicalRole: ClinicalRole | null };

export async function fetchReport(args: {
  ctx: ReportCtx;
  search: URLSearchParams;
  db?: any;
}) {
  const db: any = args.db ?? serviceClient();
  const filters = parseFilters(args.search);

  const { data: referrals, error } = await db.from("referral")
    .select("id, referral_no, source_specialty, referral_class, status, reason, source_key, charge_mode, preauth_required, series_id, created_at")
    .eq("tenant_id", args.ctx.tenantId)
    .gte("created_at", filters.date_from)
    .lte("created_at", filters.date_to)
    .order("created_at", { ascending: false })
    .limit(REPORT_SCAN_CAP + 1);
  if (error) return { ok: false as const, res: envelope(error.message ?? "database_error", "db_error", 500) };

  const list = (referrals ?? []) as ReferralInput[];
  const truncated = list.length > REPORT_SCAN_CAP;
  const capped = truncated ? list.slice(0, REPORT_SCAN_CAP) : list;
  const ids = capped.map((r) => r.id);

  let targets: TargetInput[] = [];
  if (ids.length) {
    const { data: t } = await db.from("referral_target")
      .select("id, referral_id, target_kind, target_specialty, target_facility_id, status, created_at, updated_at")
      .in("referral_id", ids);
    targets = (t ?? []) as TargetInput[];
  }

  const rows = buildRows(capped, targets, filters);
  return { ok: true as const, rows, summary: summarise(rows, filters, truncated) };
}

export async function handleGET(args: { ctx: ReportCtx; search: URLSearchParams; db?: any }): Promise<Response> {
  const r = await fetchReport(args);
  if (!r.ok) return r.res;
  return jsonData({ ok: true, data: r.summary });
}

export const Route = createFileRoute("/api/clinical/v1/opd/opd/referral/report")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireClinicalModule(request, "Registration & Eligibility", { capId: "referral.cockpit.read" });
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        return handleGET({ ctx: auth.ctx, search: url.searchParams });
      },
    },
  },
});