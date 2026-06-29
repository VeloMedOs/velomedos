import { createFileRoute } from "@tanstack/react-router";
import { PayerAgreementUpdate } from "@/lib/mds/schema/rcm";
import { itemHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/payer-agreements/$id")({
  server: { handlers: itemHandlers({
    table: "payer_agreement", audit: "payer_agreement",
    updateSchema: PayerAgreementUpdate,
  }) },
});