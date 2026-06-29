import { createFileRoute } from "@tanstack/react-router";
import { PayerUpdate } from "@/lib/mds/schema/masters";
import { itemHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/payers/$id")({
  server: { handlers: itemHandlers({ table: "payer", audit: "payer", updateSchema: PayerUpdate }) },
});