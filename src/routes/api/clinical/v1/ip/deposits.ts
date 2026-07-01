import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalRole, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody, assertMasterOwnership } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const Create = z.object({
  admission_request_id: z.string().uuid().nullable().optional(),
  encounter_id: z.string().uuid().nullable().optional(),
  beneficiary_id: z.string().uuid().nullable().optional(),
  requested_minor: z.number().int().min(0).default(0),
  amount_minor: z.number().int().min(0).default(0),
  method: z.enum(["cash","card","bank_transfer","wallet","insurance"]).default("cash"),
  status: z.enum(["requested","collected"]).default("requested"),
  reference_no: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/ip/deposits")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireTenant(request);
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const admId = url.searchParams.get("admission_request_id");
      const status = url.searchParams.get("status");
      const limit  = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      let sel: any = (serviceClient() as any).from("deposit")
        .select("*", { count: "exact" }).eq("tenant_id", auth.ctx.tenantId)
        .order("created_at", { ascending: false }).range(offset, offset + limit - 1);
      if (admId)  sel = sel.eq("admission_request_id", admId);
      if (status) sel = sel.eq("status", status);
      const { data, count, error } = await sel;
      if (error) return envelope(error.message, "db_error", 500);
      return jsonData({ data: data ?? [], pagination: { limit, offset, total: count ?? 0 } });
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalRole(request, ["tenant_admin","cashier","biller","rcm"]);
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Create.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      if (parsed.data.admission_request_id) {
        const err = await assertMasterOwnership("admission_request", parsed.data.admission_request_id, auth.ctx.tenantId);
        if (err) return err;
      }
      const db = serviceClient() as any;
      const insertRow = {
        ...parsed.data,
        tenant_id: auth.ctx.tenantId,
        received_by: parsed.data.status === "collected" ? auth.ctx.userId : null,
        received_at: parsed.data.status === "collected" ? new Date().toISOString() : null,
        created_by: auth.ctx.userId, updated_by: auth.ctx.userId,
      };
      const { data, error } = await db.from("deposit").insert(insertRow).select("*").single();
      if (error) return envelope(error.message, "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "deposit.create", "deposit", data.id);
      return jsonData({ data }, 201);
    },
  } },
});