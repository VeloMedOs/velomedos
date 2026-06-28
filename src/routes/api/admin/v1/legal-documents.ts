import { createFileRoute } from "@tanstack/react-router";
import { crudHandlers } from "@/lib/api-admin-crud";

export const Route = createFileRoute("/api/admin/v1/legal-documents")({
  server: { handlers: crudHandlers({
    table: "legal_documents",
    readScope: "config:read", writeScope: "config:write",
    allowed: ["slug","title","subtitle","body_md","version","published","effective_date"],
    filters: ["slug","published"],
    orderBy: "slug",
    stamp: (uid) => ({ updated_by: uid }),
  }) },
});