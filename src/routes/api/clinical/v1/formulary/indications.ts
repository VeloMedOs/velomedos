import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const Body = z.object({
  internal_code: z.string(),
  generic_name: z.string(),
  sfda_sci_code: z.string().nullish(),
  icd10_code: z.string(),
  icd10_description: z.string().nullish(),
  severity: z.enum(["block","warn","info"]).default("block"),
  source: z.string().nullish(),
  active: z.boolean().default(true),
});
const parse = parseBody((raw) => Body.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/formulary/indications")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireTenant(request);
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data, error } = await db.from("drug_indication_map").select("*").eq("tenant_id", auth.ctx.tenantId).limit(500);
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: data ?? [] });
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Masters & Contracts", { capId: "formulary.indications.write" });
      if (!auth.ok) return auth.res;
      const parsed = await parse(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data, error } = await db.from("drug_indication_map").insert({
        tenant_id: auth.ctx.tenantId, ...parsed.data,
        created_by: auth.ctx.userId, updated_by: auth.ctx.userId,
      }).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "formulary.indications.create", "drug_indication_map", data.id);
      return jsonData({ data }, 201);
    },
  } },
});