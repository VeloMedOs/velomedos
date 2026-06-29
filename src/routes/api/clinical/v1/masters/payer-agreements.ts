import { createFileRoute } from "@tanstack/react-router";
import { PayerAgreementCreate } from "@/lib/mds/schema/rcm";
import { listCreateHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/payer-agreements")({
  server: { handlers: listCreateHandlers({
    table: "payer_agreement", audit: "payer_agreement",
    createSchema: PayerAgreementCreate,
    filterKeys: ["payer_id", "tpa_id", "active"],
  }) },
});