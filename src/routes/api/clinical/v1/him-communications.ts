import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * POST /api/clinical/v1/him-communications
 *
 * Insert a new HIM clarification note (direction is always outbound; author
 * is forced to the caller). Requires wl.him_comm.write.
 */
const Body = z.object({
  encounter_id: z.string().uuid(),
  body: z.string().min(1).max(4000),
  channel: z.string().max(64).nullable().optional(),
  form_instance_id: z.string().uuid().nullable().optional(),
  coding_row_id: z.string().uuid().nullable().optional(),
  payload: z.record(z.string(), z.any()).nullable().optional(),
});
const parseHim = parseBody((raw) => Body.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/him-communications")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "wl.him_comm.write" });
      if (!auth.ok) return auth.res;
      const parsed = await parseHim(request);
      if (!parsed.ok) return parsed.res;

      // Confirm encounter belongs to caller's tenant.
      const db = serviceClient() as any;
      const { data: enc, error: encErr } = await db
        .from("encounter")
        .select("id, tenant_id")
        .eq("id", parsed.data.encounter_id)
        .maybeSingle();
      if (encErr) return envelope("database_error", "db_error", 500);
      if (!enc || enc.tenant_id !== auth.ctx.tenantId) {
        return envelope("encounter not found", "not_found", 404);
      }

      const { data, error } = await db
        .from("him_communication")
        .insert({
          tenant_id: auth.ctx.tenantId,
          encounter_id: parsed.data.encounter_id,
          form_instance_id: parsed.data.form_instance_id ?? null,
          coding_row_id: parsed.data.coding_row_id ?? null,
          direction: "outbound",
          channel: parsed.data.channel ?? null,
          author: auth.ctx.userId,
          body: parsed.data.body,
          payload: parsed.data.payload ?? null,
        })
        .select("*")
        .single();
      if (error) return envelope("database_error", "db_error", 400);
      return jsonData({ data });
    },
  } },
});