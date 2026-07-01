import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

const Body = z.object({
  kind: z.string(),
  title: z.string().nullable().optional(),
  url: z.string().url(),
  content_type: z.string().nullable().optional(),
  size_bytes: z.number().int().nonnegative().nullable().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/auth/requests/$id/attachments")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Authorization");
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data } = await db.from("authorization_attachment").select("*")
        .eq("tenant_id", auth.ctx.tenantId).eq("authorization_request_id", params.id)
        .order("created_at", { ascending: false });
      return jsonData({ data: data ?? [] });
    },
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Authorization", { capId: "auth.request" });
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("authorization_request", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      const parsed = await parseBody((raw) => Body.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data, error } = await db.from("authorization_attachment").insert({
        ...parsed.data,
        tenant_id: auth.ctx.tenantId,
        authorization_request_id: params.id,
        uploaded_by: auth.ctx.userId,
      }).select("*").single();
      if (error) return envelope(error.message, "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "auth_attachment.create",
        "authorization_attachment", data.id);
      return jsonData({ data }, 201);
    },
  } },
});