import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const PatchSchema = z.object({
  severity: z.enum(["block","warn","info"]).optional(),
  active: z.boolean().optional(),
  icd10_code: z.string().optional(),
  icd10_description: z.string().nullish(),
});
const parsePatch = parseBody((raw) => PatchSchema.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/formulary/indications/$id")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    PATCH: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Masters & Contracts", { capId: "formulary.indications.write" });
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("drug_indication_map", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      const parsed = await parsePatch(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data, error } = await db.from("drug_indication_map").update({
        ...parsed.data, updated_by: auth.ctx.userId,
      }).eq("id", params.id).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "formulary.indications.update", "drug_indication_map", params.id);
      return jsonData({ data });
    },
    DELETE: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Masters & Contracts", { capId: "formulary.indications.write" });
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("drug_indication_map", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      const db = serviceClient() as any;
      await db.from("drug_indication_map").update({ active: false, updated_by: auth.ctx.userId }).eq("id", params.id);
      return new Response(null, { status: 204 });
    },
  } },
});