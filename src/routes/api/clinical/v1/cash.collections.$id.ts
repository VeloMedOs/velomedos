import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R7 · Cash collection detail — row + allocations + deposit txns. */
export const Route = createFileRoute("/api/clinical/v1/cash/collections/$id")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA");
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data: row, error } = await db.from("cash_collection")
        .select("*, encounter:encounter_id(id, encounter_number), beneficiary:beneficiary_id(id, full_name, mrn), claim:claim_id(id, claim_no, total_gross_minor)")
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (error || !row) return envelope("Collection not found", "not_found", 404);
      const [{ data: dtx }, { data: sess }] = await Promise.all([
        db.from("deposit_transaction").select("*")
          .eq("tenant_id", auth.ctx.tenantId).eq("cash_collection_id", params.id)
          .order("created_at", { ascending: false }).limit(200),
        row.session_id ? db.from("cash_session_txn").select("*")
          .eq("tenant_id", auth.ctx.tenantId).eq("cash_collection_id", params.id).limit(50) : Promise.resolve({ data: [] }),
      ]);
      return jsonData({ data: { row, allocations: sess ?? [], deposit_txns: dtx ?? [] } });
    },
  } },
});