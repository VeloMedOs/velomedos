import { createFileRoute } from "@tanstack/react-router";
import { ContractChangeRequestCreate } from "@/lib/mds/schema/rcm";
import { listCreateHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/contract-change-requests")({
  server: { handlers: listCreateHandlers({
    table: "contract_change_request", audit: "contract_change_request",
    createSchema: ContractChangeRequestCreate,
    filterKeys: ["status", "target_table", "target_id"],
  }) },
});