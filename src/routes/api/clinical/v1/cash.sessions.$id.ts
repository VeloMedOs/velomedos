import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireClinicalModule, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** R7 · Cash session detail — session, txns, and collections in one payload. */
export const Route = createFileRoute("/api/clinical/v1/cash/sessions/$id")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Cash & ZATCA");
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data: session, error } = await db.from("cash_session").select("*")
        .eq("id", params.id).eq("tenant_id", auth.ctx.tenantId).maybeSingle();
      if (error || !session) return envelope("Session not found", "not_found", 404);
      const [{ data: txns }, { data: collections }] = await Promise.all([
        db.from("cash_session_txn").select("*")
          .eq("tenant_id", auth.ctx.tenantId).eq("session_id", params.id)
          .order("created_at", { ascending: false }).limit(500),
        db.from("cash_collection").select("id, receipt_no, method, gross_minor, net_collected_minor, status, posted_at")
          .eq("tenant_id", auth.ctx.tenantId).eq("session_id", params.id)
          .order("created_at", { ascending: false }).limit(200),
      ]);
      return jsonData({ data: { session, txns: txns ?? [], collections: collections ?? [] } });
    },
  } },
});