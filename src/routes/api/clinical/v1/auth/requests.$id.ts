import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody, loadOwned } from "../_helpers";
import { canTransition, type AuthStatus } from "@/lib/rcm/auth-sm";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PatchBody = z.object({
  status: z.string().optional(),
  priority: z.enum(["routine", "urgent", "emergency"]).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  valid_from: z.string().nullable().optional(),
  valid_to: z.string().nullable().optional(),
  preauth_ref: z.string().nullable().optional(),
  decision_reason: z.string().nullable().optional(),
  lock: z.boolean().optional(),
  unlock: z.boolean().optional(),
});

const LOCK_TTL_MS = 10 * 60 * 1000;

export const Route = createFileRoute("/api/clinical/v1/auth/requests/$id")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Authorization");
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("authorization_request", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      const db = serviceClient() as any;
      const [items, atts, coms] = await Promise.all([
        db.from("authorization_item").select("*").eq("authorization_request_id", params.id),
        db.from("authorization_attachment").select("*").eq("authorization_request_id", params.id),
        db.from("authorization_communication").select("*").eq("authorization_request_id", params.id)
          .order("created_at", { ascending: false }),
      ]);
      return jsonData({ data: {
        request: owned.row,
        items: items.data ?? [],
        attachments: atts.data ?? [],
        communications: coms.data ?? [],
      } });
    },
    PATCH: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Authorization", { capId: "auth.request" });
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => PatchBody.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const owned = await loadOwned<any>("authorization_request", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      const db = serviceClient() as any;
      const patch: Record<string, unknown> = { updated_by: auth.ctx.userId };
      const { lock, unlock, status, ...rest } = parsed.data;

      // Advisory lock with 10-minute TTL. Any request past TTL is swept and
      // reassigned to the current caller; collisions inside TTL return 409.
      if (owned.row.locked_by && owned.row.locked_at) {
        const age = Date.now() - new Date(owned.row.locked_at).getTime();
        if (age > LOCK_TTL_MS) {
          await db.from("authorization_request").update({ locked_by: null, locked_at: null })
            .eq("id", params.id);
          owned.row.locked_by = null; owned.row.locked_at = null;
        } else if (owned.row.locked_by !== auth.ctx.userId) {
          return envelope("Row locked by another user", "locked", 409);
        }
      }
      if (lock) { patch.locked_by = auth.ctx.userId; patch.locked_at = new Date().toISOString(); }
      if (unlock) { patch.locked_by = null; patch.locked_at = null; }

      if (status && status !== owned.row.status) {
        if (!canTransition(owned.row.status as AuthStatus, status as AuthStatus)) {
          return envelope(`Illegal transition ${owned.row.status} → ${status}`, "invalid_state", 409);
        }
        patch.status = status;
      }
      Object.assign(patch, rest);

      const { data, error } = await db.from("authorization_request").update(patch)
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "auth_request.update", "authorization_request", params.id, patch);
      return jsonData({ data });
    },
  } },
});