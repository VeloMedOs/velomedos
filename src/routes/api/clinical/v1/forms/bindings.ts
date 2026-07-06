import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const Body = z.object({
  form_def_id: z.string().uuid(),
  encounter_class: z.string().nullish(),
  module: z.string().nullish(),
  trigger: z.enum(["pre","post","on_order"]),
  assignee_role: z.string().nullish(),
  mandatory: z.boolean().default(true),
  cosign_required: z.boolean().default(false),
  due_window_minutes: z.number().int().nullish(),
  active: z.boolean().default(true),
});
const PatchBody = Body.partial().extend({ id: z.string().uuid() });
const parseCreate = parseBody((raw) => Body.parse(raw));
const parsePatch = parseBody((raw) => PatchBody.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/forms/bindings")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireTenant(request);
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data, error } = await db.from("form_workflow_binding").select("*").eq("tenant_id", auth.ctx.tenantId).limit(200);
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: data ?? [] });
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "forms.def.publish" });
      if (!auth.ok) return auth.res;
      const parsed = await parseCreate(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data, error } = await db.from("form_workflow_binding").insert({
        tenant_id: auth.ctx.tenantId, ...parsed.data,
      }).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "forms.binding.create", "form_workflow_binding", data.id);
      return jsonData({ data }, 201);
    },
    PATCH: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "forms.def.publish" });
      if (!auth.ok) return auth.res;
      const parsed = await parsePatch(request);
      if (!parsed.ok) return parsed.res;
      const { id, ...rest } = parsed.data;
      const db = serviceClient() as any;
      const { data, error } = await db.from("form_workflow_binding")
        .update(rest).eq("id", id).eq("tenant_id", auth.ctx.tenantId).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      return jsonData({ data });
    },
  } },
});