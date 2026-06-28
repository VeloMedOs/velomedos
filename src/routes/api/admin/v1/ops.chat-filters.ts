import { createFileRoute } from "@tanstack/react-router";
import { crudHandlers } from "@/lib/api-admin-crud";

export const Route = createFileRoute("/api/admin/v1/ops/chat-filters")({
  server: { handlers: crudHandlers({
    table: "ops_chat_filters",
    readScope: "config:read", writeScope: "config:write",
    allowed: ["pattern","kind","action","is_active","notes"],
    filters: ["kind","is_active"],
    stamp: (uid) => ({ created_by: uid }),
  }) },
});