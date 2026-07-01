import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { jsonData, parseBody } from "../_helpers";
import { canTransitionDenial, type DenialStatus } from "@/lib/rcm/denial-sm";

/* eslint-disable @typescript-eslint/no-explicit-any */
const Body = z.object({
  action: z.enum(["start_correction","accept","resolve","dispose","reassign"]),
  ids: z.array(z.string().uuid()).min(1).max(200),
  assignee_id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/claims-mgmt/denials/bulk")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance", { capId: "claim.assemble" });
      if (!auth.ok) return auth.res;
      const body = await parseBody((raw) => Body.parse(raw))(request);
      if (!body.ok) return body.res;
      const db = serviceClient() as any;
      const results: Array<{ id: string; ok: boolean; error?: string }> = [];
      const map: Record<string, DenialStatus> = {
        start_correction: "in_correction",
        accept: "accepted",
        resolve: "resolved",
        dispose: "disposed",
      };
      for (const id of body.data.ids) {
        try {
          const { data: d } = await db.from("denial_case").select("id, tenant_id, status").eq("id", id).maybeSingle();
          if (!d || d.tenant_id !== auth.ctx.tenantId) throw new Error("not_found");
          if (body.data.action === "reassign") {
            if (!body.data.assignee_id) throw new Error("assignee_required");
            await db.from("denial_case").update({ assigned_to: body.data.assignee_id }).eq("id", id);
          } else {
            const to = map[body.data.action];
            if (!canTransitionDenial(d.status, to)) throw new Error(`illegal_${d.status}_${to}`);
            const extra: any = {};
            if (to === "resolved") extra.resolved_at = new Date().toISOString();
            if (to === "disposed") extra.disposed_at = new Date().toISOString();
            await db.from("denial_case").update({ status: to, ...extra }).eq("id", id);
          }
          results.push({ id, ok: true });
        } catch (e) {
          results.push({ id, ok: false, error: e instanceof Error ? e.message : "error" });
        }
      }
      return jsonData({ results });
    },
  } },
});