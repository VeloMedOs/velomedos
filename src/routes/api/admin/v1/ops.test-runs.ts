import { createFileRoute } from "@tanstack/react-router";
import { crudHandlers } from "@/lib/api-admin-crud";

export const Route = createFileRoute("/api/admin/v1/ops/test-runs")({
  server: { handlers: crudHandlers({
    table: "ops_test_runs",
    readScope: "analytics:read", writeScope: "config:write",
    allowed: ["suite","branch","commit_sha","status","total","passed","failed","duration_ms","report_url","finished_at"],
    filters: ["status","suite"],
    orderBy: "started_at",
  }) },
});