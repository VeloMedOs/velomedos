import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody, assertMasterOwnership } from "../_helpers";
import { PriceListReplicateRequest } from "@/lib/mds/schema/masters";

/* eslint-disable @typescript-eslint/no-explicit-any */
const parse = parseBody((raw) => PriceListReplicateRequest.parse(raw));
const COL_MAP: Record<string, string> = {
  payer: "payer_id", tpa: "tpa_id", policy: "policy_id",
  class: "insurance_class_id", network: "network_id",
};
const REF_TABLE: Record<string, string> = {
  payer_id: "payer", tpa_id: "tpa", policy_id: "policy",
  insurance_class_id: "insurance_class", network_id: "network",
};

/** POST /masters/price-lists/$id/replicate — fan-out clone to many targets. */
export const Route = createFileRoute("/api/clinical/v1/masters/price-lists/$id/replicate")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["tenant_admin"]);
        if (!auth.ok) return auth.res;
        const owned = await loadOwned<any>("price_list", params.id, auth.ctx.tenantId);
        if (!owned.ok) return owned.res;
        const parsed = await parse(request);
        if (!parsed.ok) return parsed.res;
        const src = owned.row;
        const db = serviceClient() as any;
        const { data: items } = parsed.data.copy_items
          ? await db.from("price_list_item").select("*").eq("price_list_id", src.id)
          : { data: [] as any[] };

        const results: Array<{ price_list: any; item_count: number }> = [];
        for (const t of parsed.data.targets) {
          const scopeCols: Record<string, string | null> = {
            payer_id: null, tpa_id: null, policy_id: null, insurance_class_id: null, network_id: null,
          };
          if (t.scope_level !== "cash") {
            if (!t.scope_ref_id) return envelope("scope_ref_id required for target", "bad_request", 400);
            const col = COL_MAP[t.scope_level];
            const refErr = await assertMasterOwnership(REF_TABLE[col], t.scope_ref_id, auth.ctx.tenantId);
            if (refErr) return refErr;
            scopeCols[col] = t.scope_ref_id;
          }
          const headerRow = {
            tenant_id: auth.ctx.tenantId,
            name: t.name ?? `${src.name} (${t.scope_level} ×${t.factor})`,
            scope_level: t.scope_level,
            ...scopeCols,
            list_type: t.scope_level === "cash" ? "cash" : "payer_network",
            is_cost_basis: src.is_cost_basis ?? false,
            parent_price_list_id: src.id,
            derive_factor: t.factor,
            currency: src.currency,
            effective_date: src.effective_date,
            expiry_date: src.expiry_date,
            active: true,
            created_by: auth.ctx.userId,
            updated_by: auth.ctx.userId,
          };
          const { data: pl, error: hErr } = await db.from("price_list").insert(headerRow).select("*").single();
          if (hErr) return envelope(hErr.message, "db_error", 400);
          let count = 0;
          if ((items ?? []).length) {
            const copied = items!.map((it: any) => ({
              tenant_id: auth.ctx.tenantId,
              price_list_id: pl.id,
              service_id: it.service_id,
              drug_id: it.drug_id,
              unit_price_minor: Math.round(it.unit_price_minor * t.factor),
              default_factor: it.default_factor,
              patient_share_percent: it.patient_share_percent,
              tax_percent: it.tax_percent,
              is_package: it.is_package,
              time_band: it.time_band,
              referral_status: it.referral_status,
              created_by: auth.ctx.userId,
              updated_by: auth.ctx.userId,
            }));
            const { data: ins, error: iErr } = await db.from("price_list_item").insert(copied).select("id");
            if (iErr) return envelope(iErr.message, "items_copy_failed", 400);
            count = (ins ?? []).length;
          }
          results.push({ price_list: pl, item_count: count });
        }
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "price_list.replicate", "price_list", src.id,
          { targets: results.length });
        return jsonData({ data: { source_id: src.id, created: results } }, 201);
      },
    },
  },
});