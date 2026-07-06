import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalRole, serviceClient } from "@/lib/api-clinical";
import { jsonData, parseBody } from "../_helpers";
import { canTransitionAdmission, type AdmissionStatus } from "@/lib/rcm/ip-accounting-sm";

/* eslint-disable @typescript-eslint/no-explicit-any */
const Body = z.object({
  action: z.enum(["assign_me","cancel","authorize","advance_lounge"]),
  ids: z.array(z.string().uuid()).min(1).max(200),
  reason: z.string().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/ip/admission-requests/bulk")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalRole(request, ["tenant_admin","rcm","case_manager","cashier"]);
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Body.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const { action, ids, reason } = parsed.data;
      const db = serviceClient() as any;
      const { data: rows } = await db.from("admission_request")
        .select("id, status").eq("tenant_id", auth.ctx.tenantId).in("id", ids);
      const byId = new Map<string, any>((rows ?? []).map((r: any) => [r.id, r]));
      const results: Array<{ id: string; ok: boolean; error?: string }> = [];
      for (const id of ids) {
        const row = byId.get(id);
        if (!row) { results.push({ id, ok: false, error: "not_found" }); continue; }
        try {
          if (action === "assign_me") {
            const { error } = await db.from("admission_request")
              .update({ locked_by: auth.ctx.userId, locked_at: new Date().toISOString(), updated_by: auth.ctx.userId })
              .eq("id", id).eq("tenant_id", auth.ctx.tenantId);
            if (error) throw new Error("database_error");
          } else if (action === "cancel") {
            if (["discharged","cancelled"].includes(row.status)) throw new Error("terminal");
            const { error } = await db.from("admission_request").update({
              status: "cancelled", cancelled_at: new Date().toISOString(),
              cancel_reason: reason ?? "bulk cancel", updated_by: auth.ctx.userId,
            }).eq("id", id).eq("tenant_id", auth.ctx.tenantId);
            if (error) throw new Error("database_error");
          } else {
            const target: AdmissionStatus = action === "authorize" ? "authorized" : "lounge";
            if (!canTransitionAdmission(row.status as AdmissionStatus, target))
              throw new Error(`invalid_state: ${row.status}→${target}`);
            const { error } = await db.from("admission_request")
              .update({ status: target, updated_by: auth.ctx.userId })
              .eq("id", id).eq("tenant_id", auth.ctx.tenantId);
            if (error) throw new Error("database_error");
          }
          results.push({ id, ok: true });
        } catch (e) { results.push({ id, ok: false, error: (e as Error).message }); }
      }
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "admission_request.bulk", "admission_request", undefined,
        { action, count: ids.length, failed: results.filter((r) => !r.ok).length });
      return jsonData({ data: results });
    },
  } },
});