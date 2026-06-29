import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * GET /masters/price-lists/$id/insights
 * Per-list KPIs: catalog coverage, margin vs cost basis, upcoming versions,
 * payer-wise SBS gaps when payer-scoped.
 */
export const Route = createFileRoute("/api/clinical/v1/masters/price-lists/$id/insights")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<any>("price_list", params.id, auth.ctx.tenantId);
        if (!owned.ok) return owned.res;
        const db = serviceClient() as any;
        const tid = auth.ctx.tenantId;
        const list = owned.row;

        const [{ data: items }, { data: svcTotal }, { data: drgTotal }, costList] = await Promise.all([
          db.from("price_list_item").select("id, service_id, drug_id, unit_price_minor").eq("price_list_id", params.id),
          db.from("service_master").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("active", true),
          db.from("drug_master").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("active", true),
          db.from("price_list").select("id").eq("tenant_id", tid).eq("is_cost_basis", true).eq("active", true).limit(1).maybeSingle(),
        ]);
        const list_items = items ?? [];
        const priced_svc = new Set(list_items.filter((i: any) => i.service_id).map((i: any) => i.service_id)).size;
        const priced_drug = new Set(list_items.filter((i: any) => i.drug_id).map((i: any) => i.drug_id)).size;

        // Margin vs cost list
        let margin: any = null;
        if (costList?.data?.id) {
          const { data: costItems } = await db.from("price_list_item")
            .select("service_id, drug_id, unit_price_minor").eq("price_list_id", costList.data.id);
          const cmap = new Map<string, number>();
          for (const r of costItems ?? []) cmap.set(r.service_id ? `s:${r.service_id}` : `d:${r.drug_id}`, r.unit_price_minor);
          const lines = list_items.map((i: any): { id: string; price_minor: number; cost_minor: number | null; margin_pct: number | null } => {
            const k = i.service_id ? `s:${i.service_id}` : `d:${i.drug_id}`;
            const cost = cmap.get(k);
            const margin = cost != null && i.unit_price_minor ? (i.unit_price_minor - cost) / i.unit_price_minor : null;
            return { id: i.id, price_minor: i.unit_price_minor, cost_minor: cost ?? null, margin_pct: margin != null ? Math.round(margin * 10000) / 100 : null };
          });
          const valid = lines.filter((l: { margin_pct: number | null }) => l.margin_pct != null);
          margin = {
            cost_list_id: costList.data.id,
            coverage_pct: list_items.length ? Math.round((valid.length / list_items.length) * 10000) / 100 : 0,
            median_margin_pct: valid.length
              ? valid.map((v: { margin_pct: number | null }) => v.margin_pct!).sort((a: number, b: number) => a - b)[Math.floor(valid.length / 2)]
              : null,
            lines: lines.slice(0, 50),
          };
        }

        // Upcoming versions (effective in future)
        const today = new Date().toISOString().slice(0, 10);
        const itemIds = list_items.map((i: any) => i.id);
        let upcoming: any[] = [];
        if (itemIds.length) {
          const { data: vers } = await db.from("price_list_item_version")
            .select("price_list_item_id, unit_price_minor, effective_from, change_reason")
            .in("price_list_item_id", itemIds).gt("effective_from", today)
            .order("effective_from", { ascending: true }).limit(100);
          upcoming = vers ?? [];
        }

        // Payer-wise SBS gap (only for payer-scoped lists)
        let payerCodeGap: any = null;
        if (list.scope_level === "payer" && list.payer_id) {
          const svcIds = list_items.map((i: any) => i.service_id).filter(Boolean);
          if (svcIds.length) {
            const { data: codes } = await db.from("service_code")
              .select("service_id").eq("payer_id", list.payer_id).eq("is_primary_billing", true).in("service_id", svcIds);
            const haveCode = new Set((codes ?? []).map((c: any) => c.service_id));
            payerCodeGap = {
              payer_id: list.payer_id,
              services_in_list: svcIds.length,
              with_payer_sbs: haveCode.size,
              missing: svcIds.length - haveCode.size,
            };
          }
        }

        return jsonData({
          data: {
            list: { id: list.id, name: list.name, scope_level: list.scope_level, is_cost_basis: list.is_cost_basis },
            coverage: {
              services_priced: priced_svc,
              services_total: (svcTotal as any)?.count ?? 0,
              drugs_priced: priced_drug,
              drugs_total: (drgTotal as any)?.count ?? 0,
            },
            margin,
            upcoming_changes: upcoming,
            payer_code_gap: payerCodeGap,
          },
        });
      },
    },
  },
});