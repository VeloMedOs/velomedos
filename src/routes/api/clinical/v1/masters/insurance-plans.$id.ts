import { createFileRoute } from "@tanstack/react-router";
import { InsurancePlanUpdate } from "@/lib/mds/schema/masters";
import { itemHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/insurance-plans/$id")({
  server: { handlers: itemHandlers({
    table: "insurance_plan", audit: "insurance_plan", updateSchema: InsurancePlanUpdate,
  }) },
});