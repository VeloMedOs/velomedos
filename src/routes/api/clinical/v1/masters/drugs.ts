import { createFileRoute } from "@tanstack/react-router";
import { DrugMasterCreate } from "@/lib/mds/schema/masters";
import { listCreateHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/drugs")({
  server: { handlers: listCreateHandlers({
    table: "drug_master", audit: "drug", createSchema: DrugMasterCreate,
    filterKeys: ["internal_code", "gtin", "mrid", "active"],
  }) },
});