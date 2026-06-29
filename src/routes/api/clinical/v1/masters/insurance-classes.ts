import { createFileRoute } from "@tanstack/react-router";
import { InsuranceClassCreate } from "@/lib/mds/schema/masters";
import { listCreateHandlers } from "./_crud";
import { assertMasterOwnership } from "../_helpers";

export const Route = createFileRoute("/api/clinical/v1/masters/insurance-classes")({
  server: { handlers: listCreateHandlers({
    table: "insurance_class", audit: "insurance_class", createSchema: InsuranceClassCreate,
    filterKeys: ["policy_id", "code"],
    validateRefs: async (body, tid) => assertMasterOwnership("policy", body.policy_id, tid),
  }) },
});