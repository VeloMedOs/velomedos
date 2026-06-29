import { createFileRoute } from "@tanstack/react-router";
import { TpaUpdate } from "@/lib/mds/schema/masters";
import { itemHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/tpas/$id")({
  server: { handlers: itemHandlers({ table: "tpa", audit: "tpa", updateSchema: TpaUpdate }) },
});