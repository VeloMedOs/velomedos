import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * R5 · Remittance worklist and intake.
 *
 * GET returns bucketed remittances with counts; POST creates a new
 * `staged` remittance shell that can be enriched with lines by the
 * matching engine or manual UI.
 */
const CreateRemittance = z.object({
  payer_id: z.string().uuid(),
  remittance_ref: z.string().min(1).max(64).optional(),
  source: z.enum(["interface","file_upload"]).default("file_upload"),
  received_at: z.string().datetime().optional(),
  total_amount_minor: z.number().int().nonnegative().default(0),
  notes: z.string().max(2000).optional(),
});

export const Route = createFileRoute("/api/clinical/v1/claims-mgmt/remittances")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance");
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const status = url.searchParams.get("status") ?? "";
      const q = url.searchParams.get("q") ?? "";
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
      const db = serviceClient() as any;
      let sel = db.from("remittance").select("*").eq("tenant_id", auth.ctx.tenantId)
        .order("updated_at", { ascending: false }).limit(limit);
      if (status) sel = sel.eq("status", status);
      if (q) sel = sel.or(`remittance_ref.ilike.%${q}%`);
      const { data, error } = await sel;
      if (error) return envelope(error.message, "db_error", 500);
      const { data: all } = await db.from("remittance").select("status").eq("tenant_id", auth.ctx.tenantId);
      const counts: Record<string, number> = { staged: 0, matching: 0, matched: 0, posted: 0, reconciliation: 0, closed: 0 };
      for (const r of (all ?? []) as Array<{ status: string }>) counts[r.status] = (counts[r.status] ?? 0) + 1;
      return jsonData({ data: data ?? [], counts, pagination: { total: (data ?? []).length, limit, offset: 0 } });
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance", { capId: "claim.post" });
      if (!auth.ok) return auth.res;
      const body = await parseBody((raw) => CreateRemittance.parse(raw))(request);
      if (!body.ok) return body.res;
      const db = serviceClient() as any;
      const remitRef = body.data.remittance_ref ?? `REM-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const ins = await db.from("remittance").insert({
        tenant_id: auth.ctx.tenantId,
        remittance_ref: remitRef,
        payer_id: body.data.payer_id,
        source: body.data.source,
        received_at: body.data.received_at ?? new Date().toISOString(),
        total_amount_minor: body.data.total_amount_minor,
        status: "staged",
        notes: body.data.notes ?? null,
        created_by: auth.ctx.userId,
        updated_by: auth.ctx.userId,
      }).select("*").single();
      if (ins.error) return envelope(ins.error.message, "db_error", 500);
      return jsonData({ data: ins.data }, 201);
    },
  } },
});