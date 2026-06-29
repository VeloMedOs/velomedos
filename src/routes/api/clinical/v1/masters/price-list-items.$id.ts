import { createFileRoute } from "@tanstack/react-router";
import { PriceListItemUpdate } from "@/lib/mds/schema/masters";
import { itemHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/price-list-items/$id")({
  server: { handlers: itemHandlers({
    table: "price_list_item", audit: "price_list_item", updateSchema: PriceListItemUpdate,
  }) },
});