import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { jsonData, parseBody } from "../_helpers";
import { canTransition, type AuthStatus } from "@/lib/rcm/auth-sm";

/* eslint-disable @typescript-eslint/no-explicit-any */

const BulkBody = z.object({
  action: z.enum(["assign_me", "scrub", "submit", "cancel", "mark_self_pay"]),
  ids: z.array(z.string().uuid()).min(1).max(200),
});

type PerResult = { id: string; ok: boolean; error?: string };

export const Route = createFileRoute("/api/clinical/v1/auth/requests/bulk")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Authorization", { capId: "auth.request" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => BulkBody.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const { action, ids } = parsed.data;
      const db = serviceClient() as any;

      const { data: rows } = await db.from("authorization_request")
        .select("id, status").eq("tenant_id", auth.ctx.tenantId).in("id", ids);
      const byId = new Map<string, any>((rows ?? []).map((r: any) => [r.id, r]));

      const results: PerResult[] = [];
      for (const id of ids) {
        const row = byId.get(id);
        if (!row) { results.push({ id, ok: false, error: "not_found" }); continue; }
        try {
          if (action === "assign_me") {
            const { error } = await db.from("authorization_request")
              .update({ assigned_to: auth.ctx.userId, updated_by: auth.ctx.userId })
              .eq("id", id).eq("tenant_id", auth.ctx.tenantId);
            if (error) throw new Error("database_error");
          } else {
            const target: AuthStatus =
              action === "scrub" ? "scrubbing"
              : action === "submit" ? "ready_to_submit"
              : action === "cancel" ? "cancelled"
              : "converted_to_self_pay";
            if (row.status === target) { results.push({ id, ok: true }); continue; }
            if (!canTransition(row.status as AuthStatus, target)) {
              throw new Error(`invalid_state: ${row.status} → ${target}`);
            }
            const { error } = await db.from("authorization_request")
              .update({ status: target, updated_by: auth.ctx.userId })
              .eq("id", id).eq("tenant_id", auth.ctx.tenantId);
            if (error) throw new Error("database_error");
          }
          results.push({ id, ok: true });
        } catch (e) {
          results.push({ id, ok: false, error: (e as Error).message });
        }
      }
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "auth_request.bulk",
        "authorization_request", undefined, { action, count: ids.length, failed: results.filter((r) => !r.ok).length });
      return jsonData({ data: results });
    },
  } },
});