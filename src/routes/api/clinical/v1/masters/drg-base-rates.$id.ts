import { createFileRoute } from "@tanstack/react-router";
import { DrgBaseRateUpdate } from "@/lib/mds/schema/masters";
import { itemHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/drg-base-rates/$id")({
  server: { handlers: itemHandlers({
    table: "drg_base_rate", audit: "drg_base_rate", updateSchema: DrgBaseRateUpdate,
  }) },
});