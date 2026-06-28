import { createFileRoute } from "@tanstack/react-router";
import { crudHandlers } from "@/lib/api-admin-crud";

export const Route = createFileRoute("/api/admin/v1/ops/releases")({
  server: { handlers: crudHandlers({
    table: "ops_releases",
    readScope: "config:read", writeScope: "config:write",
    allowed: ["version","title","notes","status","channel","published_at"],
    filters: ["status","channel"],
    stamp: (uid) => ({ created_by: uid }),
  }) },
});