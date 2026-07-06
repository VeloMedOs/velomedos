import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const CreateSchema = z.object({
  form_def_id: z.string().uuid(),
  encounter_id: z.string().uuid().nullish(),
  admission_request_id: z.string().uuid().nullish(),
  order_item_table: z.string().nullish(),
  order_item_id: z.string().uuid().nullish(),
  assigned_role: z.string().nullish(),
  due_at: z.string().datetime().nullish(),
});
const parseCreate = parseBody((raw) => CreateSchema.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/forms/instances")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireTenant(request);
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const encounterId = url.searchParams.get("encounter_id");
      const db = serviceClient() as any;
      let q = db.from("clinical_form_instance").select("*").eq("tenant_id", auth.ctx.tenantId);
      if (encounterId) q = q.eq("encounter_id", encounterId);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: data ?? [] });
    },
    POST: async ({ request }) => {
      const auth = await requireTenant(request);
      if (!auth.ok) return auth.res;
      const parsed = await parseCreate(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data, error } = await db.from("clinical_form_instance").insert({
        tenant_id: auth.ctx.tenantId,
        ...parsed.data,
        status: "draft",
      }).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "forms.instance.create", "clinical_form_instance", data.id);
      return jsonData({ data }, 201);
    },
  } },
});