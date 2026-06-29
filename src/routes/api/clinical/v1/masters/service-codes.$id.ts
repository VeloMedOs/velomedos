import { createFileRoute } from "@tanstack/react-router";
import { ServiceCodeUpdate } from "@/lib/mds/schema/masters";
import { itemHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/service-codes/$id")({
  server: { handlers: itemHandlers({
    table: "service_code", audit: "service_code", updateSchema: ServiceCodeUpdate,
  }) },
});