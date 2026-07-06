import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalRole, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody } from "../_helpers";
import { canTransitionAdmission, canAdvanceDischarge, readiness } from "@/lib/rcm/ip-accounting-sm";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * R4 · unified admission-request action endpoint.
 *
 * action = authorize | lounge_gate | admit_reception | discharge_advance
 *        | transfer | extend_los | cancel
 *
 * Each action is a discriminated union so the API stays a single route while
 * every branch has strict validation.
 */
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("authorize"),
             scopes: z.array(z.enum(["package","blood","room_board"])).default(["package"]),
             estimated_cost_minor: z.number().int().min(0).optional() }),
  z.object({ action: z.literal("lounge_gate"),
             consent: z.boolean().optional(),
             bed_reserved: z.boolean().optional(),
             pac_completed: z.boolean().optional(),
             anesthesia_fit: z.boolean().nullable().optional() }),
  z.object({ action: z.literal("admit_reception"),
             room_type: z.string().optional(),
             notes: z.string().nullable().optional() }),
  z.object({ action: z.literal("discharge_advance"),
             to_stage: z.enum(["discharge_advice","discharge_order","medical_discharge","financial_discharge"]),
             notes: z.string().nullable().optional() }),
  z.object({ action: z.literal("transfer"),
             to_bed_type: z.string(),
             reason: z.string().nullable().optional() }),
  z.object({ action: z.literal("extend_los"),
             new_los_days: z.number().int().min(1),
             reason: z.string().nullable().optional() }),
  z.object({ action: z.literal("cancel"), reason: z.string().min(3) }),
]);

function nextAdmissionSerial(tenantSlug: string): string {
  // Simple time-ordered serial — reception-safe uniqueness via table PK.
  const d = new Date();
  const stamp = `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,"0")}${String(d.getUTCDate()).padStart(2,"0")}`;
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${tenantSlug || "IP"}-${stamp}-${rand}`;
}

async function fetchReadiness(db: any, tenantId: string, row: any) {
  let hasCoveredBed: boolean | undefined;
  if (row.class_id && row.room_type_entitled) {
    const { data: rbe } = await db.from("room_board_entitlement")
      .select("covered").eq("tenant_id", tenantId)
      .eq("class_id", row.class_id).eq("room_type", row.room_type_entitled).maybeSingle();
    hasCoveredBed = !!(rbe && rbe.covered);
  }
  const { data: auths } = await db.from("authorization_request")
    .select("status, auth_scope").eq("admission_request_id", row.id);
  const hasApprovedPackageAuth = (auths ?? []).some((a: any) =>
    a.auth_scope === "package" && ["approved","partially_approved"].includes(String(a.status)));
  const { count: openOrders } = await db.from("charge_item")
    .select("id", { count: "exact", head: true })
    .eq("admission_request_id", row.id).eq("status", "ordered");
  return readiness({ row, hasCoveredBed, hasApprovedPackageAuth, openOrders: openOrders ?? 0 });
}

export const Route = createFileRoute("/api/clinical/v1/ip/admission-requests/$id/action")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    POST: async ({ request, params }) => {
      const auth = await requireClinicalRole(request, [
        "tenant_admin","rcm","case_manager","physician","nurse",
        "cashier","approval_officer","front_office","registrar",
      ]);
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Body.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const own = await loadOwned<any>("admission_request", params.id, auth.ctx.tenantId);
      if (!own.ok) return own.res;
      const row = own.row;
      const db = serviceClient() as any;
      const now = new Date().toISOString();
      const upd: Record<string, unknown> = { updated_by: auth.ctx.userId };
      const extras: Record<string, unknown> = {};

      switch (parsed.data.action) {
        case "authorize": {
          if (!canTransitionAdmission(row.status, "authorized"))
            return envelope(`invalid_state: ${row.status} → authorized`, "invalid_state", 409);
          // Create one authorization_request per requested scope, linked to admission.
          const created: string[] = [];
          for (const scope of parsed.data.scopes) {
            const { data: ar, error } = await db.from("authorization_request").insert({
              tenant_id: auth.ctx.tenantId,
              encounter_id: row.encounter_id,
              admission_request_id: row.id,
              auth_scope: scope,
              beneficiary_id: row.beneficiary_id,
              coverage_id: row.coverage_id,
              eligibility_ref: row.eligibility_ref,
              payer_id: row.payer_id, policy_id: row.policy_id, class_id: row.class_id,
              status: "new",
              reasons_triggered: [`ip_${scope}`],
              requested_by: auth.ctx.userId,
              created_by: auth.ctx.userId, updated_by: auth.ctx.userId,
            }).select("id").single();
            if (!error && ar) created.push(ar.id);
          }
          upd.status = "authorized";
          extras.authorization_ids = created;
          break;
        }
        case "lounge_gate": {
          if (row.status === "authorized") {
            if (!canTransitionAdmission(row.status, "lounge"))
              return envelope("invalid_state", "invalid_state", 409);
            upd.status = "lounge";
          } else if (row.status !== "lounge") {
            return envelope(`invalid_state: gate only valid at authorized/lounge, got ${row.status}`, "invalid_state", 409);
          }
          if (parsed.data.consent)       upd.consent_captured_at = now;
          if (parsed.data.bed_reserved)  upd.bed_reserved_at = now;
          if (parsed.data.pac_completed) upd.pac_completed_at = now;
          if (parsed.data.anesthesia_fit !== undefined) {
            upd.anesthesia_fit = parsed.data.anesthesia_fit;
            upd.anesthesia_fit_at = now;
          }
          break;
        }
        case "admit_reception": {
          if (!canTransitionAdmission(row.status, "admitted"))
            return envelope(`invalid_state: ${row.status} → admitted`, "invalid_state", 409);
          const rd = await fetchReadiness(db, auth.ctx.tenantId, row);
          if (!rd.ok) return envelope("Readiness blockers present", "readiness_failed", 409, { blockers: rd.blockers });
          // Generate admission_no / serial (idempotent — keep if present).
          if (!row.admission_no) upd.admission_no = nextAdmissionSerial("IP");
          if (!row.admission_serial) upd.admission_serial = nextAdmissionSerial("SN");
          upd.status = "admitted";
          upd.admitted_at = now;
          if (parsed.data.room_type) upd.room_type_entitled = parsed.data.room_type;
          // Mirror into encounter journey.
          await db.from("encounter_advance_journey").insert({
            tenant_id: auth.ctx.tenantId, encounter_id: row.encounter_id,
            from_state: "eligibility_confirmed", to_state: "admitted",
            note: `IP admission ${upd.admission_no}`, actor_id: auth.ctx.userId,
          });
          break;
        }
        case "discharge_advance": {
          if (row.status !== "admitted")
            return envelope("Only admitted patients can advance discharge", "invalid_state", 409);
          if (!canAdvanceDischarge(row.discharge_stage, parsed.data.to_stage))
            return envelope(`invalid_stage: ${row.discharge_stage} → ${parsed.data.to_stage}`, "invalid_state", 409);
          upd.discharge_stage = parsed.data.to_stage;
          if (parsed.data.to_stage === "financial_discharge") {
            const rd = await fetchReadiness(db, auth.ctx.tenantId, row);
            if (!rd.ok) return envelope("Financial discharge blocked", "readiness_failed", 409, { blockers: rd.blockers });
            upd.status = "discharged";
            upd.discharged_at = now;
            await db.from("encounter_advance_journey").insert({
              tenant_id: auth.ctx.tenantId, encounter_id: row.encounter_id,
              from_state: "admitted", to_state: "discharged",
              note: "IP financial discharge", actor_id: auth.ctx.userId,
            });
            // Best-effort: reconcile any open emergency_override exceptions
            // on this encounter. Failures are audited, never block discharge.
            try {
              const { data: openExcs } = await db.from("rcm_gate_exception")
                .select("id, nphies_approved_minor, manual_approved_minor")
                .eq("tenant_id", auth.ctx.tenantId)
                .eq("encounter_id", row.encounter_id)
                .eq("exception_type", "emergency_override")
                .is("closed_at", null)
                .is("reconciled_at", null);
              if ((openExcs ?? []).length > 0) {
                const { reconcileEmergencyException } = await import("@/lib/rcm/emergency-reconcile");
                for (const e of openExcs ?? []) {
                  const nphies = (e as any).nphies_approved_minor ?? (e as any).manual_approved_minor ?? 0;
                  await reconcileEmergencyException(db as any, {
                    exceptionId: (e as any).id,
                    nphiesApprovedMinor: nphies,
                    actorId: auth.ctx.userId,
                  });
                }
              }
            } catch (e) {
              await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "adt.discharge.reconcile_failed",
                "admission_request", row.id, { error: (e as Error).message });
            }
          }
          break;
        }
        case "transfer": {
          if (row.status !== "admitted")
            return envelope("Only admitted patients can be transferred", "invalid_state", 409);
          // Look up tiers to decide if preauth is required.
          const { data: rbeFrom } = row.room_type_entitled && row.class_id
            ? await db.from("room_board_entitlement").select("tier")
                .eq("tenant_id", auth.ctx.tenantId).eq("class_id", row.class_id)
                .eq("room_type", row.room_type_entitled).maybeSingle()
            : { data: null };
          const { data: rbeTo } = row.class_id
            ? await db.from("room_board_entitlement").select("tier, covered, upgrade_allowed")
                .eq("tenant_id", auth.ctx.tenantId).eq("class_id", row.class_id)
                .eq("room_type", parsed.data.to_bed_type).maybeSingle()
            : { data: null };
          const fromTier = rbeFrom?.tier ?? null;
          const toTier   = rbeTo?.tier ?? null;
          const isUpgrade = (fromTier ?? 0) < (toTier ?? 0);
          const requiresPreauth = isUpgrade || !(rbeTo?.covered);
          let authId: string | null = null;
          if (requiresPreauth) {
            const { data: ar } = await db.from("authorization_request").insert({
              tenant_id: auth.ctx.tenantId,
              encounter_id: row.encounter_id,
              admission_request_id: row.id,
              auth_scope: "transfer",
              beneficiary_id: row.beneficiary_id, coverage_id: row.coverage_id,
              payer_id: row.payer_id, policy_id: row.policy_id, class_id: row.class_id,
              status: "new",
              reasons_triggered: [`transfer:${row.room_type_entitled ?? "?"}->${parsed.data.to_bed_type}`],
              requested_by: auth.ctx.userId,
              created_by: auth.ctx.userId, updated_by: auth.ctx.userId,
            }).select("id").single();
            authId = ar?.id ?? null;
          }
          const { data: tr } = await db.from("bed_transfer").insert({
            tenant_id: auth.ctx.tenantId,
            admission_request_id: row.id,
            from_bed_type: row.room_type_entitled,
            to_bed_type: parsed.data.to_bed_type,
            from_tier: fromTier, to_tier: toTier,
            requires_preauth: requiresPreauth,
            authorization_request_id: authId,
            status: requiresPreauth ? "preauth_pending" : "approved",
            reason: parsed.data.reason ?? null,
            created_by: auth.ctx.userId, updated_by: auth.ctx.userId,
          }).select("*").single();
          if (!requiresPreauth) upd.room_type_entitled = parsed.data.to_bed_type;
          extras.transfer = tr;
          break;
        }
        case "extend_los": {
          if (row.status !== "admitted")
            return envelope("Only admitted patients can extend LOS", "invalid_state", 409);
          const priorLos = row.los_days ?? null;
          const admittedAt = row.admitted_at ? new Date(row.admitted_at) : new Date();
          const newEdd = new Date(admittedAt); newEdd.setUTCDate(newEdd.getUTCDate() + parsed.data.new_los_days);
          // Every LOS extension requires payer auth.
          const { data: ar } = await db.from("authorization_request").insert({
            tenant_id: auth.ctx.tenantId,
            encounter_id: row.encounter_id,
            admission_request_id: row.id,
            auth_scope: "los_extension",
            beneficiary_id: row.beneficiary_id, coverage_id: row.coverage_id,
            payer_id: row.payer_id, policy_id: row.policy_id, class_id: row.class_id,
            status: "new",
            reasons_triggered: [`los_ext:${priorLos ?? "?"}->${parsed.data.new_los_days}`],
            requested_by: auth.ctx.userId,
            created_by: auth.ctx.userId, updated_by: auth.ctx.userId,
          }).select("id").single();
          const { data: le } = await db.from("los_extension").insert({
            tenant_id: auth.ctx.tenantId,
            admission_request_id: row.id,
            prior_los_days: priorLos,
            new_los_days: parsed.data.new_los_days,
            new_edd: newEdd.toISOString().slice(0, 10),
            reason: parsed.data.reason ?? null,
            authorization_request_id: ar?.id ?? null,
            status: "requested",
            created_by: auth.ctx.userId, updated_by: auth.ctx.userId,
          }).select("*").single();
          extras.los_extension = le;
          break;
        }
        case "cancel": {
          if (["discharged","cancelled"].includes(row.status))
            return envelope("Admission is terminal", "invalid_state", 409);
          upd.status = "cancelled";
          upd.cancelled_at = now;
          upd.cancel_reason = parsed.data.reason;
          break;
        }
      }
      const { data, error } = await db.from("admission_request")
        .update(upd).eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId,
        `admission_request.${parsed.data.action}`, "admission_request", params.id, { extras });
      return jsonData({ data: { row: data, ...extras } });
    },
  } },
});