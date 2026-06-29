import { createFileRoute } from "@tanstack/react-router";
import { ServiceCodeCreate } from "@/lib/mds/schema/masters";
import { childListCreate } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/services/$id/codes")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204 }),
      GET: async ({ request, params }) => childListCreate({
        request, parentId: params.id, parentTable: "service_master", parentFkColumn: "service_id",
        childTable: "service_code", audit: "service_code", createSchema: ServiceCodeCreate,
        filterKeys: ["code_system_id", "is_primary_billing"],
      }),
      POST: async ({ request, params }) => childListCreate({
        request, parentId: params.id, parentTable: "service_master", parentFkColumn: "service_id",
        childTable: "service_code", audit: "service_code", createSchema: ServiceCodeCreate,
      }),
    },
  },
});