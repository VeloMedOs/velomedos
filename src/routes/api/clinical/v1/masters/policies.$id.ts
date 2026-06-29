import { createFileRoute } from "@tanstack/react-router";
import { PolicyUpdate } from "@/lib/mds/schema/masters";
import { itemHandlers } from "./_crud";
import { assertMasterOwnership } from "../_helpers";

export const Route = createFileRoute("/api/clinical/v1/masters/policies/$id")({
  server: { handlers: itemHandlers({
    table: "policy", audit: "policy", updateSchema: PolicyUpdate,
    validateRefs: async (body, tid) => assertMasterOwnership("payer", body.payer_id, tid),
  }) },
});