import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

const Body = z.object({
  direction: z.enum(["inbound", "outbound", "internal"]).default("internal"),
  channel: z.enum(["note", "nphies", "phone", "email", "portal"]).default("note"),
  body: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/auth/requests/$id/communications")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Authorization");
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data } = await db.from("authorization_communication").select("*")
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
      const { data, error } = await db.from("authorization_communication").insert({
        ...parsed.data,
        tenant_id: auth.ctx.tenantId,
        authorization_request_id: params.id,
        author: auth.ctx.userId,
      }).select("*").single();
      if (error) return envelope(error.message, "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "auth_comm.create",
        "authorization_communication", data.id);
      return jsonData({ data }, 201);
    },
  } },
});