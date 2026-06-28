import { createFileRoute } from "@tanstack/react-router";
import { crudHandlers } from "@/lib/api-admin-crud";

export const Route = createFileRoute("/api/admin/v1/ops/automations")({
  server: { handlers: crudHandlers({
    table: "ops_automations",
    readScope: "config:read", writeScope: "config:write",
    allowed: ["name","kind","schedule","target_url","is_active","last_run_at","last_status","last_message"],
    filters: ["kind","is_active"],
  }) },
});