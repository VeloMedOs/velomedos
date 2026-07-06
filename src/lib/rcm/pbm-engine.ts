/**
 * PBM (Pharmacy Benefit Management) engine.
 *
 * Evaluates prescription-item saves against `drug_indication_map` and PBM
 * trigger rules. R-PBM2b: an item without a matching indication is refused
 * (422 INDICATION_MISSING) unless the caller carries the `pbm.override`
 * capability AND passes `indication_override: true`, in which case an
 * `rcm_gate_exception` (type `indication_override`) is written and the item
 * is saved.
 *
 * PBM never blocks the billed gate — releasing exceptions are for gate use;
 * `indication_override` is informational.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { evaluateTriggers, foldTriggerOutcome, loadRules } from "@/lib/mds/rules";

export type PbmValidateInput = {
  tenantId: string;
  drugId: string | null;
  override?: boolean;
  encounterId?: string | null;
  chargeItemId?: string | null;
  actorId?: string | null;
};

export type PbmValidateResult =
  | { ok: true; formulary_ok: boolean; substitutions: string[]; preauth_required: boolean; exception_id?: string }
  | { ok: false; code: "INDICATION_MISSING"; block_reason: string };

/**
 * Called from prescription-item POST/PATCH. Returns 422 shape on R-PBM2b
 * miss, or writes an `indication_override` exception when override is set.
 */
export async function validatePrescriptionItem(
  supabase: SupabaseClient<Database>,
  input: PbmValidateInput,
): Promise<PbmValidateResult> {
  const { tenantId, drugId, override, encounterId, chargeItemId, actorId } = input;

  // R-PBM2b: match the drug's `drug_indication_map` rows against the
  // encounter's `encounter_diagnosis` ICD-10 codes. If the drug has active
  // indication rows and NONE of them intersects with the encounter's
  // diagnoses, the write is refused unless the caller supplies `override`.
  let hasIndication = true;
  if (drugId) {
    // Resolve the drug's generic_name — `drug_indication_map` is keyed by
    // generic_name (Phase-14 formulary layout), not drug_id.
    const { data: drug } = await supabase
      .from("drug_master")
      .select("generic_name")
      .eq("tenant_id", tenantId)
      .eq("id", drugId)
      .maybeSingle();
    const generic = (drug as { generic_name: string | null } | null)?.generic_name ?? null;
    if (generic) {
      const { data: mapRows } = await supabase
        .from("drug_indication_map")
        .select("icd10_code")
        .eq("tenant_id", tenantId)
        .eq("generic_name", generic)
        .eq("active", true);
      const codes = ((mapRows ?? []) as Array<{ icd10_code: string | null }>)
        .map((r) => (r.icd10_code ?? "").toLowerCase()).filter(Boolean);
      if (codes.length > 0) {
        let encCodes: string[] = [];
        if (encounterId) {
          const { data: dx } = await supabase
            .from("encounter_diagnosis")
            .select("code")
            .eq("tenant_id", tenantId)
            .eq("encounter_id", encounterId);
          encCodes = ((dx ?? []) as Array<{ code: string | null }>)
            .map((r) => (r.code ?? "").toLowerCase()).filter(Boolean);
        }
        hasIndication = codes.some((c) => encCodes.includes(c));
      }
    }
  }

  // PBM rule triggers (formulary, substitution, preauth).
  const rules = await loadRules(tenantId);
  const hits = evaluateTriggers(
    rules,
    { pricing_mode: "insured", covered: true, in_network: null, drug_id: drugId ?? undefined } as never,
    "pbm",
  );
  const outcome = foldTriggerOutcome(hits);

  if (!hasIndication && !override) {
    return { ok: false, code: "INDICATION_MISSING", block_reason: "pbm_indication_missing" };
  }

  let exceptionId: string | undefined;
  if (!hasIndication && override) {
    const { data: exc } = await supabase
      .from("rcm_gate_exception")
      .insert({
        tenant_id: tenantId,
        encounter_id: encounterId ?? null,
        charge_item_id: chargeItemId ?? null,
        exception_type: "indication_override" as never,
        reason_code: "pbm_indication_missing" as never,
        reason_text: "PBM indication override",
        granted_by: actorId ?? null,
      })
      .select("id")
      .single();
    exceptionId = exc?.id;
  }

  const substitutions = hits
    .filter((h) => typeof h.action?.substitute_with === "string")
    .map((h) => h.action.substitute_with as string);

  return {
    ok: true,
    formulary_ok: hasIndication,
    substitutions,
    preauth_required: outcome.preauth_required,
    exception_id: exceptionId,
  };
}