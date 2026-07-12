/**
 * Step 5 · Turn 3 — Referral report CSV export.
 * Row-level dataset (one row per referral_target) via the shared aggregator.
 */
import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule } from "@/lib/api-clinical";
import { fetchReport, type ReportCtx } from "./opd.referral.report";
import { toCsv } from "@/lib/mds/referral-report";

/* eslint-disable @typescript-eslint/no-explicit-any */

function stampFromIso(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

export async function handleGET(args: { ctx: ReportCtx; search: URLSearchParams; db?: any }): Promise<Response> {
  const r = await fetchReport(args);
  if (!r.ok) return r.res;
  const csv = toCsv(r.rows);
  const from = stampFromIso(r.summary.filters.date_from);
  const to = stampFromIso(r.summary.filters.date_to);
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="referral-report-${from}-${to}.csv"`,
      "x-report-rows": String(r.rows.length),
      "x-report-truncated": r.summary.truncated ? "1" : "0",
    },
  });
}

export const Route = createFileRoute("/api/clinical/v1/opd/referral/report.csv")({
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