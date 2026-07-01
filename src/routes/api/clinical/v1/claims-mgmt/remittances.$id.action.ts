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
            if (ln.bill_ref) {
              const q = await db.from("claim").select("id, total_payer_share_minor").eq("tenant_id", auth.ctx.tenantId).eq("invoice_no", ln.bill_ref).maybeSingle();
              claim = q.data;
            }
            if (!claim && ln.claim_sequence_no) {
              const q = await db.from("claim").select("id, total_payer_share_minor").eq("tenant_id", auth.ctx.tenantId).eq("claim_sequence_no", ln.claim_sequence_no).order("created_at", { ascending: false }).limit(1);
              claim = (q.data ?? [])[0];
            }
            if (!claim) {
              await db.from("remittance_line").update({ match_status: "unmatched" }).eq("id", ln.id);
              continue;
            }
            const target = claim.total_payer_share_minor ?? 0;
            const paid = ln.paid_amount_minor ?? 0;
            const diff = Math.abs(paid - target);
            await db.from("remittance_line").update({
              claim_id: claim.id,
              allocated_amount_minor: paid,
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
          // Aggregate paid vs target per claim to decide reconciliation vs posted.
          const perClaim = new Map<string, { paid: number; target: number }>();
          for (const ln of (lines ?? []) as any[]) {
            if (!ln.claim_id) continue;
            const cur = perClaim.get(ln.claim_id) ?? { paid: 0, target: 0 };
            cur.paid += ln.paid_amount_minor ?? 0;
            perClaim.set(ln.claim_id, cur);
          }
          for (const [cid, agg] of perClaim.entries()) {
            const { data: claim } = await db.from("claim").select("total_payer_share_minor").eq("id", cid).maybeSingle();
            agg.target = claim?.total_payer_share_minor ?? 0;
          }
          const hasShort = Array.from(perClaim.values()).some((a) => a.paid < a.target);
          const now = new Date().toISOString();
          // Trigger `remittance_post_apply` fires when status flips to 'posted'
          // and settles per-claim status + encounter journey.
          await db.from("remittance").update({
            status: "posted",
            posted_at: now,
            posted_by: auth.ctx.userId,
            updated_by: auth.ctx.userId,
          }).eq("id", params.id);
          if (hasShort) {
            await db.from("remittance").update({ status: "reconciliation", updated_by: auth.ctx.userId }).eq("id", params.id);
          }
          return jsonData({ ok: true, status: hasShort ? "reconciliation" : "posted" });
        }

        if (body.data.action === "reconcile") {
          await move("reconciliation", body.data.note ? { notes: body.data.note } : {});
          return jsonData({ ok: true, status: "reconciliation" });
        }
        if (body.data.action === "close") {
          await move("closed");
          return jsonData({ ok: true, status: "closed" });
        }
      } catch (e) {
        return envelope(e instanceof Error ? e.message : "error", "action_failed", 409);
      }
      return envelope("Unknown action", "bad_action", 400);
    },
  } },
});