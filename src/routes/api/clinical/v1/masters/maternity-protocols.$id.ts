import { createFileRoute } from "@tanstack/react-router";
import { MaternityProtocolUpdate } from "@/lib/mds/schema/rcm";
import { itemHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/maternity-protocols/$id")({
  server: { handlers: itemHandlers({
    table: "maternity_protocol", audit: "maternity_protocol",
    updateSchema: MaternityProtocolUpdate,
  }) },
});