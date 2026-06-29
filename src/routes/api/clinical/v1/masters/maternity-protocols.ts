import { createFileRoute } from "@tanstack/react-router";
import { MaternityProtocolCreate } from "@/lib/mds/schema/rcm";
import { listCreateHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/maternity-protocols")({
  server: { handlers: listCreateHandlers({
    table: "maternity_protocol", audit: "maternity_protocol",
    createSchema: MaternityProtocolCreate,
    filterKeys: ["payer_id", "policy_id", "active"],
  }) },
});