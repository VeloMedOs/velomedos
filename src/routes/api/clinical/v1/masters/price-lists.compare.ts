import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** GET /masters/price-lists/compare?left=...&right=... — line-by-line diff. */
export const Route = createFileRoute("/api/clinical/v1/masters/price-lists/compare")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const left = url.searchParams.get("left");
        const right = url.searchParams.get("right");
        if (!left || !right) return envelope("left and right required", "bad_request", 400);
        const db = serviceClient() as any;

        const [{ data: lH }, { data: rH }] = await Promise.all([
          db.from("price_list").select("*").eq("id", left).eq("tenant_id", auth.ctx.tenantId).maybeSingle(),
          db.from("price_list").select("*").eq("id", right).eq("tenant_id", auth.ctx.tenantId).maybeSingle(),
        ]);
        if (!lH || !rH) return envelope("price list not found", "not_found", 404);

        const [{ data: lI }, { data: rI }] = await Promise.all([
          db.from("price_list_item").select("service_id, drug_id, unit_price_minor").eq("price_list_id", left),
          db.from("price_list_item").select("service_id, drug_id, unit_price_minor").eq("price_list_id", right),
        ]);
        const key = (r: any) => r.service_id ? `s:${r.service_id}` : `d:${r.drug_id}`;
        const lMap = new Map<string, number>(); for (const r of lI ?? []) lMap.set(key(r), r.unit_price_minor);
        const rMap = new Map<string, number>(); for (const r of rI ?? []) rMap.set(key(r), r.unit_price_minor);
        const keys = new Set<string>([...lMap.keys(), ...rMap.keys()]);
        const rows = [...keys].map((k) => {
          const L = lMap.get(k) ?? null;
          const R = rMap.get(k) ?? null;
          const delta = (L != null && R != null) ? R - L : null;
          const pct = (delta != null && L) ? Math.round((delta / L) * 10000) / 100 : null;
          return {
            kind: k.startsWith("s:") ? "service" : "drug",
            id: k.slice(2),
            left_minor: L, right_minor: R, delta_minor: delta, delta_pct: pct,
            missing_left: L == null, missing_right: R == null,
          };
        });
        return jsonData({
          data: {
            left: { id: lH.id, name: lH.name, scope_level: lH.scope_level },
            right: { id: rH.id, name: rH.name, scope_level: rH.scope_level },
            count: rows.length,
            rows,
          },
        });
      },
    },
  },
});