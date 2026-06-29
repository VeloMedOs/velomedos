import { createFileRoute } from "@tanstack/react-router";
import { NetworkUpdate } from "@/lib/mds/schema/masters";
import { itemHandlers } from "./_crud";
import { assertMasterOwnership } from "../_helpers";

export const Route = createFileRoute("/api/clinical/v1/masters/networks/$id")({
  server: { handlers: itemHandlers({
    table: "network", audit: "network", updateSchema: NetworkUpdate,
    validateRefs: async (body, tid) => assertMasterOwnership("payer", body.payer_id, tid),
  }) },
});