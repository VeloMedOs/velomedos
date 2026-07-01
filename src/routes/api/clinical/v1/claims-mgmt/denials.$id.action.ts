import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";
import { canTransitionDenial, type DenialStatus, type DenialFinanceDisposition } from "@/lib/rcm/denial-sm";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Denial-case lifecycle transitions.
 *
 *  start_correction     — assigns to a coder/officer, moves to in_correction
 *  resubmit             — clones the source claim (new snapshot), moves the case
 *                         to resubmitted and links `resubmission_claim_id`
 *  accept               — accept denial as final; must be finalized by `dispose`
 *  dispose              — finance write-off / adjustment, moves to disposed
 *  resolve              — mark resolved after successful resubmission remit
 *  add_communication    — append a note / letter / call log
 */
const Body = z.object({
  action: z.enum(["start_correction","resubmit","accept","dispose","resolve","add_communication"]),
  note: z.string().max(4000).optional(),
  disposition: z.enum(["none","write_off","adjustment"]).optional(),
  disposition_amount_minor: z.number().int().nonnegative().optional(),
  direction: z.enum(["outbound","inbound","internal"]).default("internal").optional(),
  channel: z.enum(["note","email","phone","portal","letter"]).default("note").optional(),
  assignee_id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/claims-mgmt/denials/$id/action")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Claims & Remittance", { capId: "claim.assemble" });
      if (!auth.ok) return auth.res;
      const body = await parseBody((raw) => Body.parse(raw))(request);
      if (!body.ok) return body.res;
      const db = serviceClient() as any;
      const { data: d } = await db.from("denial_case").select("*").eq("id", params.id).maybeSingle();
      if (!d || d.tenant_id !== auth.ctx.tenantId) return envelope("not_found", "not_found", 404);

      const move = async (to: DenialStatus, extra: Record<string, unknown> = {}) => {
        if (!canTransitionDenial(d.status, to)) throw new Error(`illegal_transition_${d.status}_${to}`);
        await db.from("denial_case").update({ status: to, updated_by: auth.ctx.userId, ...extra }).eq("id", params.id);
      };

      try {
        if (body.data.action === "add_communication") {
          if (!body.data.note) return envelope("Note required", "bad_input", 400);
          const ins = await db.from("denial_communication").insert({
            tenant_id: auth.ctx.tenantId,
            denial_case_id: params.id,
            direction: body.data.direction ?? "internal",
            channel: body.data.channel ?? "note",
            actor_id: auth.ctx.userId,
            body: body.data.note,
          }).select("*").single();
          if (ins.error) return envelope(ins.error.message, "db_error", 500);
          return jsonData({ data: ins.data }, 201);
        }

        if (body.data.action === "start_correction") {
          await move("in_correction", { assigned_to: body.data.assignee_id ?? auth.ctx.userId });
          return jsonData({ ok: true, status: "in_correction" });
        }

        if (body.data.action === "resubmit") {
          const { data: src } = await db.from("claim").select("*").eq("id", d.claim_id).maybeSingle();
          if (!src) return envelope("source_claim_missing", "not_found", 404);
          const cloneNo = `${src.provider_claim_no ?? "CL"}-R${Date.now().toString(36)}`;
          const clone = await db.from("claim").insert({
            tenant_id: auth.ctx.tenantId,
            encounter_id: src.encounter_id,
            coverage_id: src.coverage_id,
            billing_model: src.billing_model,
            currency: src.currency,
            provider_claim_no: cloneNo,
            claim_sequence_no: src.claim_sequence_no,
            status: "draft",
            readiness_status: "hold",
            replaces_claim_id: src.id,
          }).select("*").single();
          if (clone.error) return envelope(clone.error.message, "db_error", 500);
          await move("resubmitted", { replaces_claim_id: clone.data.id });
          return jsonData({ ok: true, status: "resubmitted", claim: clone.data });
        }

        if (body.data.action === "accept") {
          await move("accepted");
          return jsonData({ ok: true, status: "accepted" });
        }

        if (body.data.action === "dispose") {
          const disp: DenialFinanceDisposition = body.data.disposition ?? "write_off";
          await move("disposed", {
            finance_disposition: disp,
            disposition_amount_minor: body.data.disposition_amount_minor ?? 0,
            disposition_note: body.data.note ?? null,
            disposed_at: new Date().toISOString(),
            disposed_by: auth.ctx.userId,
          });
          return jsonData({ ok: true, status: "disposed", disposition: disp });
        }

        if (body.data.action === "resolve") {
          await move("resolved");
          return jsonData({ ok: true, status: "resolved" });
        }
      } catch (e) {
        return envelope(e instanceof Error ? e.message : "error", "action_failed", 409);
      }
      return envelope("Unknown action", "bad_action", 400);
    },
  } },
});