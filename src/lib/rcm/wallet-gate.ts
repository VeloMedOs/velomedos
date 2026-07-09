/**
 * Step 4 · Turn 2 · Wallet gate (file 17 §4).
 *
 * For OPD (`class='AMB'`) encounters, opening a new order is blocked when the
 * beneficiary wallet is negative. Missing wallet = open. This helper is the
 * single enforcement point invoked from `_order-factory` and is the target of
 * fixture assertions for negative/positive/missing-wallet cases.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export type WalletGateResult = { open: true } | { open: false; beneficiary_id: string };

export async function walletGateAllowsOrder(
  db: any, tenantId: string, encounterId: string,
): Promise<WalletGateResult> {
  const { data: enc } = await db.from("encounter")
    .select("class, beneficiary_id").eq("id", encounterId).maybeSingle();
  if (!enc || enc.class !== "AMB" || !enc.beneficiary_id) return { open: true };
  const { data } = await db.rpc("wallet_gate_open", {
    _beneficiary_id: enc.beneficiary_id, _tenant_id: tenantId,
  });
  if (data === false) return { open: false, beneficiary_id: enc.beneficiary_id };
  return { open: true };
}