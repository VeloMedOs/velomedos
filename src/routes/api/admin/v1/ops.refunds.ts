import { createFileRoute } from "@tanstack/react-router";
import { crudHandlers } from "@/lib/api-admin-crud";

export const Route = createFileRoute("/api/admin/v1/ops/refunds")({
  server: { handlers: crudHandlers({
    table: "ops_refunds",
    readScope: "billing:read", writeScope: "billing:write",
    allowed: ["payment_id","subscriber_id","amount_cents","currency","reason","status","external_ref","processed_at"],
    filters: ["status","subscriber_id"],
    stamp: (uid) => ({ created_by: uid }),
  }) },
});
