import { createFileRoute } from "@tanstack/react-router";
import { NetworkMembershipUpdate } from "@/lib/mds/schema/masters";
import { itemHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/network-memberships/$id")({
  server: { handlers: itemHandlers({
    table: "network_membership", audit: "network_membership", updateSchema: NetworkMembershipUpdate,
  }) },
});