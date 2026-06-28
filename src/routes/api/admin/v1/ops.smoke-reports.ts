import { createFileRoute } from "@tanstack/react-router";
import { crudHandlers } from "@/lib/api-admin-crud";

export const Route = createFileRoute("/api/admin/v1/ops/smoke-reports")({
  server: { handlers: crudHandlers({
    table: "ops_smoke_reports",
    readScope: "analytics:read", writeScope: "config:write",
    allowed: ["target","status","latency_ms","http_status","message"],
    filters: ["status","target"],
    orderBy: "checked_at",
  }) },
});