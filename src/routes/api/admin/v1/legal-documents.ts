import { createFileRoute } from "@tanstack/react-router";
import { crudHandlers } from "@/lib/api-admin-crud";

export const Route = createFileRoute("/api/admin/v1/legal-documents")({
  server: { handlers: crudHandlers({
    table: "legal_documents",
    readScope: "config:read", writeScope: "config:write",
    allowed: ["slug","locale","title","summary","subtitle","body_md","body_html","status","effective_date"],
    filters: ["slug","locale","status"],
    orderBy: "slug",
    stamp: (uid) => ({ updated_by: uid }),
  }) },
});