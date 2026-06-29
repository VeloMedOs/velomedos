import { createFileRoute } from "@tanstack/react-router";
import { PolicyCreate } from "@/lib/mds/schema/masters";
import { listCreateHandlers } from "./_crud";
import { assertMasterOwnership } from "../_helpers";

export const Route = createFileRoute("/api/clinical/v1/masters/policies")({
  server: { handlers: listCreateHandlers({
    table: "policy", audit: "policy", createSchema: PolicyCreate,
    filterKeys: ["payer_id", "policy_number", "active"],
    validateRefs: async (body, tid) => assertMasterOwnership("payer", body.payer_id, tid),
  }) },
});