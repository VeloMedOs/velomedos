/**
 * Emergency reconciliation loop.
 *
 * When NPHIES adjudicates an authorization for an encounter that was released
 * under an `emergency_override` `rcm_gate_exception`, the wallet must catch up
 * with the delta between the manual approved amount (recorded when the
 * exception was granted) and the payer's actual approved amount.
 *
 * This module is effectful: it posts a `wallet_txn`, adjusts the wallet
 * balance via the atomic `public.wallet_apply_txn(_wallet_id, _delta_minor)`
 * RPC (the ONLY supported write path for `patient_wallet.balance_minor`), and
 * stamps the exception as reconciled — all inside a single service-role
 * call chain. Idempotent: the loop no-ops once `rcm_gate_exception.reconciled_at`
 * is set.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ReconcileInput = {
  exceptionId: string;
  nphiesApprovedMinor: number;
  actorId?: string | null;
};

export type ReconcileResult =
  | { ok: true; already: true }
  | { ok: true; already: false; wallet_delta_minor: number; direction: "credit" | "debit"; wallet_txn_id: string }
  | { ok: false; code: "exception_not_found" | "already_reconciled" | "wallet_write_failed"; message: string };

/** Pure delta helper — never touches the DB. */
export function computeWalletDelta(manualApprovedMinor: number, nphiesApprovedMinor: number): number {
  return nphiesApprovedMinor - manualApprovedMinor;
}

/**
 * Post the delta between manual approval and NPHIES approval to the patient
 * wallet, then stamp the exception as reconciled. Idempotent: returns
 * `already:true` if the exception was already reconciled.
 */
export async function reconcileEmergencyException(
  supabase: SupabaseClient<Database>,
  input: ReconcileInput,
): Promise<ReconcileResult> {
  const { exceptionId, nphiesApprovedMinor, actorId } = input;

  const { data: exc, error: excErr } = await supabase
    .from("rcm_gate_exception")
    .select("id, tenant_id, encounter_id, manual_approved_minor, reconciled_at, exception_type")
    .eq("id", exceptionId)
    .maybeSingle();
  if (excErr || !exc) {
    return { ok: false, code: "exception_not_found", message: "exception not found" };
  }
  // Idempotency guard — decision.ts and submit.ts can fire for the same
  // authorization round-trip; without this, wallet_txn would double-post.
  if (exc.reconciled_at) {
    return { ok: true, already: true };
  }

  const manual = exc.manual_approved_minor ?? 0;
  const delta = computeWalletDelta(manual, nphiesApprovedMinor);
  const direction: "credit" | "debit" = delta >= 0 ? "credit" : "debit";
  const amount = Math.abs(delta);

  // Resolve the wallet (via encounter → beneficiary). Emergency overrides
  // are always encounter-scoped.
  const { data: enc } = await supabase
    .from("encounter")
    .select("beneficiary_id")
    .eq("id", exc.encounter_id!)
    .maybeSingle();
  const beneficiaryId = enc?.beneficiary_id ?? null;
  if (!beneficiaryId) {
    return { ok: false, code: "wallet_write_failed", message: "encounter has no beneficiary" };
  }

  let walletId: string | null = null;
  const { data: wallet } = await supabase
    .from("patient_wallet")
    .select("id")
    .eq("tenant_id", exc.tenant_id)
    .eq("beneficiary_id", beneficiaryId)
    .maybeSingle();
  if (wallet) {
    walletId = wallet.id;
  } else {
    const { data: created, error: cErr } = await supabase
      .from("patient_wallet")
      .insert({ tenant_id: exc.tenant_id, beneficiary_id: beneficiaryId })
      .select("id")
      .single();
    if (cErr || !created) return { ok: false, code: "wallet_write_failed", message: "wallet create failed" };
    walletId = created.id;
  }

  let txnId = "";
  if (amount > 0) {
    const { data: txn, error: txnErr } = await supabase
      .from("wallet_txn")
      .insert({
        tenant_id: exc.tenant_id,
        wallet_id: walletId!,
        direction,
        source: "emergency_reconcile",
        source_ref_id: exc.id,
        related_exception_id: exc.id,
        amount_minor: amount,
        reason: `emergency reconcile (manual ${manual} → nphies ${nphiesApprovedMinor})`,
        created_by: actorId ?? null,
      })
      .select("id")
      .single();
    if (txnErr || !txn) return { ok: false, code: "wallet_write_failed", message: "wallet_txn insert failed" };
    txnId = txn.id;

    // Atomic adjust via the RPC — no read-modify-write of balance_minor.
    const signedDelta = direction === "credit" ? amount : -amount;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcErr } = await (supabase as any).rpc("wallet_apply_txn", {
      _wallet_id: walletId!,
      _delta_minor: signedDelta,
    });
    if (rpcErr) return { ok: false, code: "wallet_write_failed", message: "wallet_apply_txn rpc failed" };
  }

  await supabase
    .from("rcm_gate_exception")
    .update({
      reconciled_at: new Date().toISOString(),
      nphies_approved_minor: nphiesApprovedMinor,
      wallet_delta_minor: delta,
    })
    .eq("id", exceptionId)
    .is("reconciled_at", null);

  return { ok: true, already: false, wallet_delta_minor: delta, direction, wallet_txn_id: txnId };
}