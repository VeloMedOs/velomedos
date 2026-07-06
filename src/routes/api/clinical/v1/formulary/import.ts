import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const RowSchema = z.object({
  scientific_code_root: z.string(),
  scientific_name: z.string(),
  atc_code: z.string().nullish(),
  pharmaceutical_form: z.string().nullish(),
  indication_icd10am: z.array(z.string()).nullish(),
  coverage_notes: z.string().nullish(),
  otc_flag: z.boolean().optional().default(false),
});
const Body = z.object({
  publish: z.boolean().default(false),
  rows: z.array(RowSchema).min(1).max(5000),
});
const parse = parseBody((raw) => Body.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/formulary/import")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Masters & Contracts", { capId: "formulary.import" });
      if (!auth.ok) return auth.res;
      const parsed = await parse(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const codes = parsed.data.rows.map((r) => r.scientific_code_root);
      const { data: existing } = await db.from("chi_formulary")
        .select("scientific_code_root").eq("tenant_id", auth.ctx.tenantId).in("scientific_code_root", codes);
      const existingSet = new Set((existing ?? []).map((r: any) => r.scientific_code_root));
      const summary = {
        total: parsed.data.rows.length,
        new: parsed.data.rows.filter((r) => !existingSet.has(r.scientific_code_root)).length,
        updates: parsed.data.rows.filter((r) => existingSet.has(r.scientific_code_root)).length,
      };
      if (!parsed.data.publish) return jsonData({ data: { staged: true, summary } });

      const rows = parsed.data.rows.map((r) => ({
        tenant_id: auth.ctx.tenantId, ...r, active: true, created_by: auth.ctx.userId, updated_by: auth.ctx.userId,
      }));
      const { error } = await db.from("chi_formulary").upsert(rows, { onConflict: "tenant_id,scientific_code_root" });
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "formulary.import", "chi_formulary", undefined, summary);
      return jsonData({ data: { published: true, summary } });
    },
  } },
});