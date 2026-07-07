import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PATCH /api/clinical/v1/him-communications/$id/read
 *
 * Idempotently marks a HIM message as read by the caller. Bounded to inbound
 * messages authored by another user — the poster never auto-marks their own
 * outbound message.
 */
export const Route = createFileRoute("/api/clinical/v1/him-communications/$id/read")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    PATCH: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "wl.him_comm.read" });
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data: row, error: gErr } = await db
        .from("him_communication")
        .select("id, tenant_id, direction, author, read_at")
        .eq("id", params.id)
        .maybeSingle();
      if (gErr) return envelope("database_error", "db_error", 500);
      if (!row || row.tenant_id !== auth.ctx.tenantId) {
        return envelope("not found", "not_found", 404);
      }
      // Only inbound & authored-by-someone-else may auto-mark as read.
      if (row.read_at || row.direction !== "inbound" || row.author === auth.ctx.userId) {
        return jsonData({ data: { id: row.id, read_at: row.read_at } });
      }
      const now = new Date().toISOString();
      const { data, error } = await db
        .from("him_communication")
        .update({ read_at: now, read_by: auth.ctx.userId })
        .eq("id", params.id)
        .is("read_at", null)
        .select("id, read_at")
        .maybeSingle();
      if (error) return envelope("database_error", "db_error", 400);
      return jsonData({ data: data ?? { id: params.id, read_at: now } });
    },
  } },
});