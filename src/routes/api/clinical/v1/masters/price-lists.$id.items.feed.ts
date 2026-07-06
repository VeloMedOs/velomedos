import { createFileRoute } from "@tanstack/react-router";
import { clinicalAudit, preflight, requireClinicalRole, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody } from "../_helpers";
import { CatalogFeedRequest } from "@/lib/mds/schema/masters";

/* eslint-disable @typescript-eslint/no-explicit-any */
const parse = parseBody((raw) => CatalogFeedRequest.parse(raw));

const DRUG_COL: Record<string, string> = { mrid: "mrid", sfda: "sfda_sci_code", gtin: "gtin", atc: "atc_code" };

/** POST /masters/price-lists/$id/items:feed — bulk add from catalog. */
export const Route = createFileRoute("/api/clinical/v1/masters/price-lists/$id/items/feed")({
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
        const db = serviceClient() as any;
        const tid = auth.ctx.tenantId;

        // Resolve services
        const serviceIds = new Set<string>();
        if (body.source !== "drug") {
          if (body.ids?.length) {
            const { data } = await db.from("service_master").select("id").eq("tenant_id", tid).in("id", body.ids);
            for (const r of data ?? []) serviceIds.add(r.id);
          } else {
            let q = db.from("service_master").select("id").eq("tenant_id", tid).eq("active", true).limit(body.limit);
            if (body.service_type) q = q.eq("service_type", body.service_type);
            const { data: svcs } = await q;
            for (const s of svcs ?? []) serviceIds.add(s.id);
            if (body.code_system && body.code_query && ["sbs","achi","loinc"].includes(body.code_system)) {
              const { data: sys } = await db.from("code_system").select("id, slug").ilike("slug", `%${body.code_system}%`);
              const sysIds = (sys ?? []).map((r: any) => r.id);
              if (sysIds.length) {
                const { data: codes } = await db.from("service_code")
                  .select("service_id").in("code_system_id", sysIds).ilike("code", `%${body.code_query}%`).limit(body.limit);
                serviceIds.clear();
                for (const c of codes ?? []) serviceIds.add(c.service_id);
              }
            }
          }
        }

        // Resolve drugs
        const drugIds = new Set<string>();
        if (body.source !== "service") {
          if (body.ids?.length) {
            const { data } = await db.from("drug_master").select("id").eq("tenant_id", tid).in("id", body.ids);
            for (const r of data ?? []) drugIds.add(r.id);
          } else {
            let q = db.from("drug_master").select("id").eq("tenant_id", tid).eq("active", true).limit(body.limit);
            if (body.code_system && body.code_query && DRUG_COL[body.code_system]) {
              q = q.ilike(DRUG_COL[body.code_system], `%${body.code_query}%`);
            }
            const { data } = await q;
            for (const d of data ?? []) drugIds.add(d.id);
          }
        }

        // Existing items to dedupe
        const { data: existing } = await db.from("price_list_item")
          .select("service_id, drug_id").eq("price_list_id", params.id);
        const exSvc = new Set((existing ?? []).map((r: any) => r.service_id).filter(Boolean));
        const exDrug = new Set((existing ?? []).map((r: any) => r.drug_id).filter(Boolean));
        for (const id of exSvc) serviceIds.delete(id as string);
        for (const id of exDrug) drugIds.delete(id as string);

        // Price source map (from another list × factor)
        const priceMap = new Map<string, number>();
        if (body.from_price_list_id) {
          const { data: src } = await db.from("price_list_item")
            .select("service_id, drug_id, unit_price_minor").eq("price_list_id", body.from_price_list_id);
          for (const r of src ?? []) {
            if (r.service_id) priceMap.set(`s:${r.service_id}`, r.unit_price_minor);
            if (r.drug_id) priceMap.set(`d:${r.drug_id}`, r.unit_price_minor);
          }
        }
        const priceFor = (kind: "s"|"d", id: string) => {
          const src = priceMap.get(`${kind}:${id}`);
          if (src != null) return Math.round(src * body.factor);
          return body.default_unit_price_minor ?? 0;
        };

        const rows: any[] = [];
        for (const id of serviceIds) rows.push({
          tenant_id: tid, price_list_id: params.id, service_id: id, drug_id: null,
          unit_price_minor: priceFor("s", id), default_factor: 1, is_package: false,
          created_by: auth.ctx.userId, updated_by: auth.ctx.userId,
        });
        for (const id of drugIds) rows.push({
          tenant_id: tid, price_list_id: params.id, service_id: null, drug_id: id,
          unit_price_minor: priceFor("d", id), default_factor: 1, is_package: false,
          created_by: auth.ctx.userId, updated_by: auth.ctx.userId,
        });

        let inserted = 0;
        if (rows.length) {
          const { data: ins, error } = await db.from("price_list_item").insert(rows).select("id");
          if (error) return envelope("database_error", "db_error", 400);
          inserted = (ins ?? []).length;
        }
        await clinicalAudit(auth.ctx.userId, tid, "price_list.feed", "price_list", params.id,
          { inserted, services: serviceIds.size, drugs: drugIds.size });
        return jsonData({ data: { inserted, services: serviceIds.size, drugs: drugIds.size, skipped_existing: (existing ?? []).length } }, 201);
      },
    },
  },
});