import { createFileRoute } from "@tanstack/react-router";
import { EpItemUpdate } from "@/lib/mds/schema/orders";
import { orderItemHandlers } from "../_order-factory";

export const Route = createFileRoute("/api/clinical/v1/orders/ep-items/$id")({
  server: { handlers: orderItemHandlers({
    table: "ep_order_item", audit: "ep_order_item",
    updateSchema: EpItemUpdate, patchRoles: ["physician"],
  }) },
});