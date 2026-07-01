import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CreateBody = z.object({
  encounter_id: z.string().uuid().nullable().optional(),
  beneficiary_id: z.string().uuid().nullable().optional(),
  coverage_id: z.string().uuid().nullable().optional(),
  priority: z.enum(["routine", "urgent", "emergency"]).optional(),
  notes: z.string().trim().nullable().optional(),
  reasons_triggered: z.array(z.string()).optional(),
  items: z.array(z.object({
    source: z.enum(["service", "drug"]),
    service_id: z.string().uuid().nullable().optional(),
    drug_id: z.string().uuid().nullable().optional(),
    charge_item_id: z.string().uuid().nullable().optional(),
    quantity: z.number().min(0).optional(),
    quantity_code: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
  })).default([]),
});

export const Route = createFileRoute("/api/clinical/v1/auth/requests")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Authorization");
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const status = url.searchParams.get("status");
      const encounter_id = url.searchParams.get("encounter_id");
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      const db = serviceClient() as any;
      let q = db.from("authorization_request").select("*", { count: "exact" })
        .eq("tenant_id", auth.ctx.tenantId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (status) q = q.eq("status", status);
      if (encounter_id) q = q.eq("encounter_id", encounter_id);
      const { data, count, error } = await q;
      if (error) return envelope(error.message, "db_error", 500);
      return jsonData({ data: data ?? [], pagination: { limit, offset, total: count ?? 0 } });
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Authorization", { capId: "auth.request" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => CreateBody.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const body = parsed.data;
      const db = serviceClient() as any;
      const { items, ...header } = body;
      const { data: hdr, error } = await db.from("authorization_request").insert({
        ...header,
        tenant_id: auth.ctx.tenantId,
        requested_by: auth.ctx.userId,
        created_by: auth.ctx.userId,
        updated_by: auth.ctx.userId,
      }).select("*").single();
      if (error) return envelope(error.message, "db_error", 400);
      if (items?.length) {
        const rows = items.map((it) => ({
          ...it,
          tenant_id: auth.ctx.tenantId,
          authorization_request_id: hdr.id,
          created_by: auth.ctx.userId,
          updated_by: auth.ctx.userId,
        }));
        const { error: iErr } = await db.from("authorization_item").insert(rows);
        if (iErr) return envelope(iErr.message, "db_error", 400);
      }
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "auth_request.create", "authorization_request", hdr.id);
      return jsonData({ data: hdr }, 201);
    },
  } },
});