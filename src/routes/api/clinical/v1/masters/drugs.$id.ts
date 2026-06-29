import { createFileRoute } from "@tanstack/react-router";
import { DrugMasterUpdate } from "@/lib/mds/schema/masters";
import { itemHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/drugs/$id")({
  server: { handlers: itemHandlers({
    table: "drug_master", audit: "drug", updateSchema: DrugMasterUpdate,
  }) },
});