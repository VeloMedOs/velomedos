import { createFileRoute } from "@tanstack/react-router";
import { NetworkCreate } from "@/lib/mds/schema/masters";
import { listCreateHandlers } from "./_crud";
import { assertMasterOwnership } from "../_helpers";

export const Route = createFileRoute("/api/clinical/v1/masters/networks")({
  server: { handlers: listCreateHandlers({
    table: "network", audit: "network", createSchema: NetworkCreate,
    filterKeys: ["payer_id", "active", "tier"],
    validateRefs: async (body, tid) => assertMasterOwnership("payer", body.payer_id, tid),
  }) },
});