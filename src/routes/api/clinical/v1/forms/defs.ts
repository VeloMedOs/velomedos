import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const CreateSchema = z.object({
  slug: z.string().min(2).max(120),
  title: z.string().min(1).max(200),
  schema_json: z.unknown(),
  encounter_class: z.string().nullish(),
  module: z.string().nullish(),
  active: z.boolean().optional().default(true),
});
const parseCreate = parseBody((raw) => CreateSchema.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/forms/defs")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireTenant(request);
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data, error } = await db.from("form_def").select("*").eq("tenant_id", auth.ctx.tenantId).order("created_at", { ascending: false }).limit(200);
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: data ?? [] });
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "forms.def.publish" });
      if (!auth.ok) return auth.res;
      const parsed = await parseCreate(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data, error } = await db.from("form_def").insert({
        tenant_id: auth.ctx.tenantId,
        ...parsed.data,
        version: 1,
        created_by: auth.ctx.userId,
      }).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "forms.def.create", "form_def", data.id);
      return jsonData({ data }, 201);
    },
  } },
});