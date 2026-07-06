import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "../_helpers";
import { chargeIsBilled, type BilledGateFacts } from "@/lib/rcm/billed-gate";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/clinical/v1/gate/preview?charge_id=…
 *
 * Returns the TS mirror `BilledGateOutcome` (explain-why) for a charge_item.
 * The SQL trigger remains the enforcing gate — this is UX and worklist tint.
 */
export const Route = createFileRoute("/api/clinical/v1/gate/preview")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Clinical", { capId: "gate.preview" });
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const chargeId = url.searchParams.get("charge_id");
      if (!chargeId) return envelope("charge_id required", "bad_request", 400);

      const db = serviceClient() as any;
      const { data: charge } = await db.from("charge_item").select("*").eq("id", chargeId).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (!charge) return envelope("charge not found", "not_found", 404);

      const { data: encounter } = await db.from("encounter")
        .select("id, class, beneficiary_id, tenant_id").eq("id", charge.encounter_id).maybeSingle();
      if (!encounter || encounter.tenant_id !== auth.ctx.tenantId) return envelope("encounter not found", "not_found", 404);

      const { data: admissions } = await db.from("admission_request")
        .select("id, status, request_type, coverage_id, requested_deposit_minor, paid_amount_minor, estimated_charges_minor, created_at")
        .eq("encounter_id", charge.encounter_id).neq("status", "cancelled")
        .order("created_at", { ascending: false });
      const admission = (admissions ?? [])[0] ?? null;
      const admissionIds = (admissions ?? []).map((a: any) => a.id);

      const [refunds, deposits, cashCollections, chargeItems, claims, authItems, exceptions, wallet] = await Promise.all([
        db.from("refund_request").select("id, tenant_id, status, deposit_id").eq("tenant_id", auth.ctx.tenantId),
        db.from("deposit").select("id, encounter_id, admission_request_id").eq("tenant_id", auth.ctx.tenantId),
        db.from("cash_collection").select("status, net_collected_minor, encounter_id, claim_id").eq("tenant_id", auth.ctx.tenantId).eq("encounter_id", charge.encounter_id),
        db.from("charge_item").select("id, encounter_id, pricing_mode, status, net_minor").eq("encounter_id", charge.encounter_id),
        db.from("claim").select("id, encounter_id").eq("encounter_id", charge.encounter_id),
        db.from("authorization_item").select("charge_item_id, decision").eq("charge_item_id", charge.id),
        db.from("rcm_gate_exception").select("charge_item_id, encounter_id, admission_request_id, closed_at, expires_at, exception_type")
          .or(`charge_item_id.eq.${charge.id},encounter_id.eq.${charge.encounter_id}${admission ? `,admission_request_id.eq.${admission.id}` : ""}`),
        db.from("patient_wallet").select("balance_minor").eq("tenant_id", auth.ctx.tenantId).eq("beneficiary_id", encounter.beneficiary_id).maybeSingle(),
      ]);

      // Auth-approved on admission's encounter?
      let admissionAuthApproved = false;
      if (admission) {
        const { data: authApproved } = await db
          .from("authorization_request")
          .select("id, authorization_item!inner(decision)")
          .eq("encounter_id", charge.encounter_id);
        admissionAuthApproved = !!(authApproved ?? []).some((r: any) => (r.authorization_item ?? []).some((ai: any) => ai.decision === "approved" || ai.decision === "partial"));
      }

      const ipPctRaw = await db.rpc("rcm_admin_config_get", { _tenant: auth.ctx.tenantId, _key: "ip_deposit_min_percent", _default: 35 });
      const ipPct = Number(ipPctRaw?.data ?? 35);

      const facts: BilledGateFacts = {
        charge,
        encounter: { id: encounter.id, class: encounter.class, beneficiary_id: encounter.beneficiary_id },
        admission: admission ?? null,
        refunds: refunds.data ?? [],
        deposits: deposits.data ?? [],
        cashCollections: cashCollections.data ?? [],
        chargeItemsForEncounter: chargeItems.data ?? [],
        claimsForEncounter: claims.data ?? [],
        authItems: authItems.data ?? [],
        admissionAuthApproved,
        exceptions: exceptions.data ?? [],
        walletBalanceMinor: wallet.data?.balance_minor ?? 0,
        orderItemPreauthRequired: false,
        serviceMasterPreauthRequired: false,
        drugMasterPreauthRequired: false,
        ipDepositMinPercent: ipPct,
        admissionIdsForEncounter: admissionIds,
      };

      const outcome = chargeIsBilled(facts);
      return jsonData({ data: { outcome, charge_id: charge.id, encounter_class: encounter.class, pricing_mode: charge.pricing_mode } });
    },
  } },
});