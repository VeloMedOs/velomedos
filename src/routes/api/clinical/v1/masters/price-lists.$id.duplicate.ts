import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody, assertMasterOwnership } from "../_helpers";
import { PriceListDuplicateRequest } from "@/lib/mds/schema/masters";

/* eslint-disable @typescript-eslint/no-explicit-any */
const parse = parseBody((raw) => PriceListDuplicateRequest.parse(raw));

/**
 * POST /masters/price-lists/$id/duplicate
 * Clone source list as a new (independent) list. Items copied with
 * unit_price_minor = round(source × factor). Provenance preserved via
 * parent_price_list_id + derive_factor.
 */
export const Route = createFileRoute("/api/clinical/v1/masters/price-lists/$id/duplicate")({
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
        const body = parsed.data;

        const scopeCols = { payer_id: null, tpa_id: null, policy_id: null, insurance_class_id: null, network_id: null } as Record<string, string | null>;
        if (body.scope_level !== "cash") {
          const colMap: Record<string, string> = {
            payer: "payer_id", tpa: "tpa_id", policy: "policy_id",
            class: "insurance_class_id", network: "network_id",
          };
          const col = colMap[body.scope_level];
          if (!body.scope_ref_id) return envelope("scope_ref_id required", "bad_request", 400);
          const refTable: Record<string, string> = {
            payer_id: "payer", tpa_id: "tpa", policy_id: "policy",
            insurance_class_id: "insurance_class", network_id: "network",
          };
          const refErr = await assertMasterOwnership(refTable[col], body.scope_ref_id, auth.ctx.tenantId);
          if (refErr) return refErr;
          scopeCols[col] = body.scope_ref_id;
        }

        const db = serviceClient() as any;
        const src = owned.row;
        const headerRow = {
          tenant_id: auth.ctx.tenantId,
          name: body.name,
          scope_level: body.scope_level,
          ...scopeCols,
          list_type: body.scope_level === "cash" ? "cash" : "payer_network",
          is_cost_basis: src.is_cost_basis ?? false,
          parent_price_list_id: src.id,
          derive_factor: body.factor,
          currency: src.currency,
          effective_date: src.effective_date,
          expiry_date: src.expiry_date,
          active: true,
          created_by: auth.ctx.userId,
          updated_by: auth.ctx.userId,
        };
        const { data: newList, error: hErr } = await db.from("price_list").insert(headerRow).select("*").single();
        if (hErr) return envelope(hErr.message, "db_error", 400);

        const { data: items } = await db.from("price_list_item").select("*").eq("price_list_id", src.id);
        const copied = (items ?? []).map((it: any) => ({
          tenant_id: auth.ctx.tenantId,
          price_list_id: newList.id,
          service_id: it.service_id,
          drug_id: it.drug_id,
          unit_price_minor: Math.round(it.unit_price_minor * body.factor),
          default_factor: it.default_factor,
          patient_share_percent: it.patient_share_percent,
          tax_percent: it.tax_percent,
          is_package: it.is_package,
          time_band: it.time_band,
          referral_status: it.referral_status,
          created_by: auth.ctx.userId,
          updated_by: auth.ctx.userId,
        }));
        let inserted: any[] = [];
        if (copied.length) {
          const { data: ins, error: iErr } = await db.from("price_list_item").insert(copied).select("*");
          if (iErr) return envelope(iErr.message, "items_copy_failed", 400);
          inserted = ins ?? [];
        }
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "price_list.duplicate", "price_list", newList.id,
          { source_id: src.id, factor: body.factor, items: inserted.length });
        return jsonData({ data: { price_list: newList, item_count: inserted.length } }, 201);
      },
    },
  },
});