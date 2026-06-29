import { createFileRoute } from "@tanstack/react-router";
import { ServiceMasterCreate } from "@/lib/mds/schema/masters";
import { listCreateHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/services")({
  server: { handlers: listCreateHandlers({
    table: "service_master", audit: "service", createSchema: ServiceMasterCreate,
    filterKeys: ["service_type", "active", "internal_code"],
  }) },
});