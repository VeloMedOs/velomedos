import { createFileRoute } from "@tanstack/react-router";
import { crudHandlers } from "@/lib/api-admin-crud";

export const Route = createFileRoute("/api/admin/v1/ops/reviews")({
  server: { handlers: crudHandlers({
    table: "ops_reviews",
    readScope: "tickets:read", writeScope: "tickets:write",
    allowed: ["trip_id","patient_id","tenant_id","rating","comment","status","moderated_by","moderated_at"],
    filters: ["status","tenant_id"],
  }) },
});
