import { createFileRoute } from "@tanstack/react-router";
import { ServiceOrderCreate } from "@/lib/mds/schema/orders";
import { orderRouteHandlers } from "./_order-factory";

export const Route = createFileRoute("/api/clinical/v1/encounters/$id/orders/service")({
  server: { handlers: orderRouteHandlers({
    headerTable: "service_order",
    itemTable: "service_order_item",
    audit: "service_order",
    createSchema: ServiceOrderCreate,
    postRoles: ["physician", "nurse"],
    itemToRow: (it) => ({
      service_id: it.service_id,
      quantity: it.quantity ?? 1,
      body_site: it.body_site ?? null,
    }),
    resolveRef: (it) => ({ source: "service", serviceId: it.service_id, quantity: it.quantity ?? 1, bodySite: it.body_site ?? null }),
  }) },
});