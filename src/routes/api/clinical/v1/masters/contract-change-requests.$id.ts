import { createFileRoute } from "@tanstack/react-router";
import { ContractChangeRequestUpdate } from "@/lib/mds/schema/rcm";
import { itemHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/contract-change-requests/$id")({
  server: { handlers: itemHandlers({
    table: "contract_change_request", audit: "contract_change_request",
    updateSchema: ContractChangeRequestUpdate,
  }) },
});