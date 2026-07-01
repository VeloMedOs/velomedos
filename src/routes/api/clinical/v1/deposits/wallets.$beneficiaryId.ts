import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { jsonData } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R6 · Patient wallet + txn history (upserts wallet if missing so callers get a valid balance). */
export const Route = createFileRoute("/api/clinical/v1/deposits/wallets/$beneficiaryId")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Deposits & Refunds");
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data: wallet } = await db.from("patient_wallet").select("*")
        .eq("tenant_id", auth.ctx.tenantId).eq("beneficiary_id", params.beneficiaryId).maybeSingle();
      const walletId = wallet?.id;
      const { data: txns } = walletId
        ? await db.from("wallet_txn").select("*").eq("wallet_id", walletId).order("created_at", { ascending: false })
        : { data: [] };
      return jsonData({ data: { wallet: wallet ?? null, txns: txns ?? [] } });
    },
  } },
});