import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "../_helpers";
import { canTransitionRemittance, type RemittanceStatus } from "@/lib/rcm/remittance-sm";
import { validateRemittanceLines } from "@/lib/rcm/validation";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Remittance state actions.
 *
 *  match  — attempts auto-match of unmatched lines to open claim balances by
 *           provider_claim_no / claim_sequence_no; sets match_status per line.
 *  post   — settles matched lines onto claims (paid_amount_minor, adjudication),
 *           advances encounter.journey_state to `settled`/`part_paid`/`denied`,
 *           and moves the remittance to `posted` or `reconciliation`.
 *  reconcile — manual disposition of remaining mismatches.
 *  close  — finalize after posting/reconcile.
 */
const Body = z.object({
  action: z.enum(["match","post","reconcile","close"]),
  note: z.string().max(1000).optional(),
});

export const Route = createFileRoute("/api/clinical/v1/claims-mgmt/remittances/$id/action")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const cap = "claim.post";
      const auth = await requireClinicalModule(request, "Claims & Remittance", { capId: cap });
      if (!auth.ok) return auth.res;
      const body = await parseBody((raw) => Body.parse(raw))(request);
      if (!body.ok) return body.res;
      const db = serviceClient() as any;
      const { data: r } = await db.from("remittance").select("*").eq("id", params.id).maybeSingle();
      if (!r || r.tenant_id !== auth.ctx.tenantId) return envelope("not_found", "not_found", 404);

      const move = async (to: RemittanceStatus, extra: Record<string, unknown> = {}) => {
        if (!canTransitionRemittance(r.status, to)) throw new Error(`illegal_transition_${r.status}_${to}`);
        await db.from("remittance").update({ status: to, updated_by: auth.ctx.userId, ...extra }).eq("id", params.id);
      };

      try {
        if (body.data.action === "match") {
          await move("matching");
          const { data: lines } = await db.from("remittance_line").select("*").eq("remittance_id", params.id);
          for (const ln of (lines ?? []) as any[]) {
            if (ln.claim_id) continue;
            let claim: any = null;
            if (ln.provider_claim_no) {
              const q = await db.from("claim").select("id, total_net_minor").eq("tenant_id", auth.ctx.tenantId).eq("provider_claim_no", ln.provider_claim_no).maybeSingle();
              claim = q.data;
            }
            if (!claim && ln.claim_sequence_no) {
              const q = await db.from("claim").select("id, total_net_minor").eq("tenant_id", auth.ctx.tenantId).eq("claim_sequence_no", ln.claim_sequence_no).order("created_at", { ascending: false }).limit(1);
              claim = (q.data ?? [])[0];
            }
            if (!claim) {
              await db.from("remittance_line").update({ match_status: "unmatched" }).eq("id", ln.id);
              continue;
            }
            const diff = Math.abs((ln.paid_amount_minor ?? 0) - (ln.expected_amount_minor ?? claim.total_net_minor ?? 0));
            await db.from("remittance_line").update({
              claim_id: claim.id,
              match_status: diff <= 1 ? "matched" : "mismatch",
            }).eq("id", ln.id);
          }
          const { data: refreshed } = await db.from("remittance_line").select("match_status").eq("remittance_id", params.id);
          const allMatched = (refreshed ?? []).every((l: any) => l.match_status === "matched" || l.match_status === "manual");
          await db.from("remittance").update({ status: allMatched ? "matched" : "matching", updated_by: auth.ctx.userId }).eq("id", params.id);
          return jsonData({ ok: true, status: allMatched ? "matched" : "matching" });
        }

        if (body.data.action === "post") {
          if (r.status !== "matched") return envelope(`Cannot post from ${r.status}`, "invalid_state", 409);
          const { data: lines } = await db.from("remittance_line").select("*").eq("remittance_id", params.id);
          const issues = validateRemittanceLines((lines ?? []) as any[]);
          if (issues.length) return envelope("Lines not ready", "remit_not_ready", 409, { issues });
          const now = new Date().toISOString();
          let hasShort = false;
          for (const ln of (lines ?? []) as any[]) {
            if (!ln.claim_id) continue;
            const { data: claim } = await db.from("claim").select("id, encounter_id, status, total_net_minor, total_payer_share_minor").eq("id", ln.claim_id).maybeSingle();
            if (!claim) continue;
            const expected = ln.expected_amount_minor ?? claim.total_payer_share_minor ?? claim.total_net_minor ?? 0;
            const paid = ln.paid_amount_minor ?? 0;
            const short = paid < expected;
            hasShort = hasShort || short;
            const newStatus = paid <= 0 ? "denied" : short ? "part_paid" : "paid";
            await db.from("claim").update({ status: newStatus, adjudication_outcome: newStatus, updated_at: now }).eq("id", claim.id);
            await db.from("claim_lifecycle_event").insert({
              tenant_id: auth.ctx.tenantId, claim_id: claim.id,
              from_status: claim.status, to_status: newStatus,
              actor_id: auth.ctx.userId,
              reason: `Remittance ${r.remittance_no} posted (${paid}/${expected})`,
            });
            if (claim.encounter_id) {
              const journey = newStatus === "denied" ? "denied" : short ? "part_settled" : "settled";
              await db.from("encounter").update({ journey_state: journey }).eq("id", claim.encounter_id);
            }
          }
          await db.from("remittance").update({
            status: hasShort ? "reconciliation" : "posted",
            posted_at: now,
            updated_by: auth.ctx.userId,
          }).eq("id", params.id);
          return jsonData({ ok: true, status: hasShort ? "reconciliation" : "posted" });
        }

        if (body.data.action === "reconcile") {
          await move("reconciliation", { notes: body.data.note ?? r.notes });
          return jsonData({ ok: true, status: "reconciliation" });
        }
        if (body.data.action === "close") {
          await move("closed", { closed_at: new Date().toISOString() });
          return jsonData({ ok: true, status: "closed" });
        }
      } catch (e) {
        return envelope(e instanceof Error ? e.message : "error", "action_failed", 409);
      }
      return envelope("Unknown action", "bad_action", 400);
    },
  } },
});