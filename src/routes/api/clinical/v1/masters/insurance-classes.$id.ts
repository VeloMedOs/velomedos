import { createFileRoute } from "@tanstack/react-router";
import { InsuranceClassUpdate } from "@/lib/mds/schema/masters";
import { itemHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/insurance-classes/$id")({
  server: { handlers: itemHandlers({
    table: "insurance_class", audit: "insurance_class", updateSchema: InsuranceClassUpdate,
  }) },
});