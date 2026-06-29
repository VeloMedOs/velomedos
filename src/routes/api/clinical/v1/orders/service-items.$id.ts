import { createFileRoute } from "@tanstack/react-router";
import { ServiceItemUpdate } from "@/lib/mds/schema/orders";
import { orderItemHandlers } from "../_order-factory";

export const Route = createFileRoute("/api/clinical/v1/orders/service-items/$id")({
  server: { handlers: orderItemHandlers({
    table: "service_order_item", audit: "service_order_item",
    updateSchema: ServiceItemUpdate, patchRoles: ["physician", "nurse"],
  }) },
});