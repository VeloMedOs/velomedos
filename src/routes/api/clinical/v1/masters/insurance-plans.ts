import { createFileRoute } from "@tanstack/react-router";
import { InsurancePlanCreate } from "@/lib/mds/schema/masters";
import { listCreateHandlers } from "./_crud";
import { assertMasterOwnership } from "../_helpers";

export const Route = createFileRoute("/api/clinical/v1/masters/insurance-plans")({
  server: { handlers: listCreateHandlers({
    table: "insurance_plan", audit: "insurance_plan", createSchema: InsurancePlanCreate,
    filterKeys: ["class_id", "code"],
    validateRefs: async (body, tid) => assertMasterOwnership("insurance_class", body.class_id, tid),
  }) },
});