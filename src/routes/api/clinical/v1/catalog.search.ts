import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireTenant, serviceClient } from "@/lib/api-clinical";
import { jsonData } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DRUG_COL: Record<string, string> = { mrid: "mrid", sfda: "sfda_sci_code", gtin: "gtin", atc: "atc_code" };

/** GET /catalog/search — unified service + drug browse backing the price-list feed UI. */
export const Route = createFileRoute("/api/clinical/v1/catalog/search")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const url = new URL(request.url);
        const q = url.searchParams.get("q")?.trim() ?? "";
        const source = (url.searchParams.get("source") ?? "both") as "service" | "drug" | "both";
        const service_type = url.searchParams.get("service_type");
        const code_system = url.searchParams.get("code_system");
        const code = url.searchParams.get("code")?.trim();
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25)));
        const db = serviceClient() as any;
        const tid = auth.ctx.tenantId;

        const services: any[] = [];
        if (source !== "drug") {
          let sq = db.from("service_master").select("*").eq("tenant_id", tid).eq("active", true).limit(limit);
          if (q) sq = sq.or(`name.ilike.%${q}%,internal_code.ilike.%${q}%`);
          if (service_type) sq = sq.eq("service_type", service_type);
          let svcs: any[] = (await sq).data ?? [];
          if (code_system && code && ["sbs","achi","loinc"].includes(code_system)) {
            const { data: sys } = await db.from("code_system").select("id").ilike("slug", `%${code_system}%`);
            const sysIds = (sys ?? []).map((s: any) => s.id);
            if (sysIds.length) {
              const { data: codes } = await db.from("service_code")
                .select("service_id").in("code_system_id", sysIds).ilike("code", `%${code}%`).limit(limit);
              const keep = new Set((codes ?? []).map((c: any) => c.service_id));
              svcs = svcs.filter((s) => keep.has(s.id));
            }
          }
          if (svcs.length) {
            const { data: allCodes } = await db.from("service_code")
              .select("service_id, code, payer_id, is_primary_billing, code_system_id")
              .in("service_id", svcs.map((s) => s.id));
            const grouped = new Map<string, any[]>();
            for (const c of allCodes ?? []) {
              const arr = grouped.get(c.service_id) ?? []; arr.push(c); grouped.set(c.service_id, arr);
            }
            for (const s of svcs) services.push({ ...s, codes: grouped.get(s.id) ?? [] });
          }
        }

        const drugs: any[] = [];
        if (source !== "service") {
          let dq = db.from("drug_master").select("*").eq("tenant_id", tid).eq("active", true).limit(limit);
          if (q) dq = dq.or(`generic_name.ilike.%${q}%,trade_name.ilike.%${q}%,internal_code.ilike.%${q}%`);
          if (code_system && code && DRUG_COL[code_system]) dq = dq.ilike(DRUG_COL[code_system], `%${code}%`);
          drugs.push(...((await dq).data ?? []));
        }

        return jsonData({ data: { services, drugs } });
      },
    },
  },
});