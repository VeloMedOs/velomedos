import { createFileRoute } from "@tanstack/react-router";
import { TpaCreate } from "@/lib/mds/schema/masters";
import { listCreateHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/tpas")({
  server: { handlers: listCreateHandlers({
    table: "tpa", audit: "tpa", createSchema: TpaCreate,
    filterKeys: ["nphies_tpa_id", "active"],
  }) },
});