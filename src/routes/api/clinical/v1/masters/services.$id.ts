import { createFileRoute } from "@tanstack/react-router";
import { ServiceMasterUpdate } from "@/lib/mds/schema/masters";
import { itemHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/services/$id")({
  server: { handlers: itemHandlers({
    table: "service_master", audit: "service", updateSchema: ServiceMasterUpdate,
  }) },
});