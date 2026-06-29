import { createFileRoute } from "@tanstack/react-router";
import { PayerCreate } from "@/lib/mds/schema/masters";
import { listCreateHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/payers")({
  server: { handlers: listCreateHandlers({
    table: "payer", audit: "payer", createSchema: PayerCreate,
    filterKeys: ["nphies_payer_id", "payer_type", "active"],
  }) },
});