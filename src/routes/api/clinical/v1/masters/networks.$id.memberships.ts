import { createFileRoute } from "@tanstack/react-router";
import { NetworkMembershipCreate } from "@/lib/mds/schema/masters";
import { childListCreate } from "./_crud";
import { assertMasterOwnership } from "../_helpers";

export const Route = createFileRoute("/api/clinical/v1/masters/networks/$id/memberships")({
  server: {
    handlers: {
      OPTIONS: () => childListCreate({
        request: new Request("about:blank", { method: "OPTIONS" }),
        parentId: "", parentTable: "network", parentFkColumn: "network_id",
        childTable: "network_membership", audit: "network_membership",
        createSchema: NetworkMembershipCreate,
      }),
      GET: async ({ request, params }) => childListCreate({
        request, parentId: params.id, parentTable: "network", parentFkColumn: "network_id",
        childTable: "network_membership", audit: "network_membership",
        createSchema: NetworkMembershipCreate,
      }),
      POST: async ({ request, params }) => childListCreate({
        request, parentId: params.id, parentTable: "network", parentFkColumn: "network_id",
        childTable: "network_membership", audit: "network_membership",
        createSchema: NetworkMembershipCreate,
        // Facility must belong to the tenant (clinics.tenant_id) once populated.
        validateRefs: async (body, tid) => assertMasterOwnership("clinics", body.provider_facility_id, tid),
      }),
    },
  },
});