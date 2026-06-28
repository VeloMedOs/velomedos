import { createFileRoute } from "@tanstack/react-router";
import { crudHandlers } from "@/lib/api-admin-crud";

export const Route = createFileRoute("/api/admin/v1/ops/notifications")({
  server: { handlers: crudHandlers({
    table: "ops_notifications",
    readScope: "tickets:read", writeScope: "tickets:write",
    allowed: ["title","body","severity","audience","audience_tenant_id","audience_user_id","link_to","expires_at"],
    filters: ["audience","severity"],
    stamp: (uid) => ({ created_by: uid }),
  }) },
});