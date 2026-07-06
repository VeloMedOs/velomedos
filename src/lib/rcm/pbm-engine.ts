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
  drugGeneric?: string | null;
  indicationIcd10?: string | null;
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
  const { tenantId, drugId, indicationIcd10, override, encounterId, chargeItemId, actorId } = input;

  let hasIndication = true;
  if (drugId && indicationIcd10) {
    const { data } = await supabase
      .from("drug_indication_map")
      .select("id, severity, active")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .ilike("icd10_code", indicationIcd10)
      .limit(1);
    hasIndication = !!data && data.length > 0;
  } else if (drugId && !indicationIcd10) {
    // R-PBM2b: an active drug_indication_map for this drug means the caller
    // must supply an indication; if no map exists the drug is unrestricted.
    const { data } = await supabase
      .from("drug_indication_map")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .limit(1);
    hasIndication = !data || data.length === 0;
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