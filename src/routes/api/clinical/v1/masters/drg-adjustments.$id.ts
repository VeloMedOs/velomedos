import { createFileRoute } from "@tanstack/react-router";
import { DrgPriceAdjustmentUpdate } from "@/lib/mds/schema/masters";
import { itemHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/drg-adjustments/$id")({
  server: { handlers: itemHandlers({
    table: "drg_price_adjustment", audit: "drg_adjustment", updateSchema: DrgPriceAdjustmentUpdate,
  }) },
});