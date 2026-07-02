import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";
import { buildD365Summary } from "@/lib/rcm/d365-summary";
import { logCall } from "@/lib/rcm/interface-registry";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * R7 · D365 daily summary.
 *   GET  — compute the summary for `?date=YYYY-MM-DD` (no side-effects)
 *   POST — compute + enqueue as an outbound `d365.finance` interface_log row.
 */
function parseDate(request: Request, fallback = false): string {
  const d = new URL(request.url).searchParams.get("date");
  return d ?? (fallback ? new Date().toISOString().slice(0, 10) : "");
}

async function buildSummary(tenantId: string, date: string) {
  const db = serviceClient() as any;
  const start = `${date}T00:00:00.000Z`;
  const end   = `${date}T23:59:59.999Z`;
  const [{ data: cash }, { data: refunds }, { data: dep }, { data: remit }] = await Promise.all([
    db.from("cash_collection").select("method, gross_minor, net_collected_minor")
      .eq("tenant_id", tenantId).eq("status", "posted").gte("posted_at", start).lte("posted_at", end),
    db.from("cash_collection").select("method, net_collected_minor")
      .eq("tenant_id", tenantId).eq("status", "voided").gte("voided_at", start).lte("voided_at", end),
    db.from("deposit_transaction").select("txn_type, amount_minor")
      .eq("tenant_id", tenantId).gte("created_at", start).lte("created_at", end),
    db.from("remittance").select("total_paid_minor").eq("tenant_id", tenantId)
      .gte("created_at", start).lte("created_at", end),
  ]);
  return buildD365Summary({
    tenant_id: tenantId, date,
    collections: (cash ?? []).map((c: any) => ({ method: c.method, amount_minor: c.net_collected_minor })),
    refunds:     (refunds ?? []).map((c: any) => ({ method: c.method, amount_minor: c.net_collected_minor })),
    deposits_in: (dep ?? []).filter((d: any) => d.txn_type === "collect").map((d: any) => ({ amount_minor: d.amount_minor })),
    deposits_out:(dep ?? []).filter((d: any) => d.txn_type === "refund").map((d: any) => ({ amount_minor: d.amount_minor })),
    remittance_ack: (remit ?? []).map((r: any) => ({ amount_minor: r.total_paid_minor ?? 0 })),
  });
}

export const Route = createFileRoute("/api/clinical/v1/interfaces/d365/summary")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA", { capId: "cash.interfaces" });
      if (!auth.ok) return auth.res;
      const date = parseDate(request, true);
      try { return jsonData({ data: await buildSummary(auth.ctx.tenantId, date) }); }
      catch (e) { return envelope((e as Error).message, "summary_error", 500); }
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA", { capId: "iface.d365.post" });
      if (!auth.ok) return auth.res;
      let date = "";
      try { const body = await request.json(); date = (body as { date?: string }).date ?? ""; }
      catch { /* fall through */ }
      if (!date) date = new Date().toISOString().slice(0, 10);
      const summary = await buildSummary(auth.ctx.tenantId, date);
      const db = serviceClient() as any;
      await logCall({ db, tenantId: auth.ctx.tenantId, interfaceKey: "d365.finance",
        direction: "outbound", trigger: "d365.daily_summary",
        correlationId: summary.correlation_id, payload: summary, status: "queued" });
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "iface.d365.summary.post", "interface_log", undefined, { date, total: summary.totals });
      return jsonData({ data: summary });
    },
  } },
});