import { createFileRoute } from "@tanstack/react-router";
import { EpOrderCreate } from "@/lib/mds/schema/orders";
import { orderRouteHandlers } from "./_order-factory";

export const Route = createFileRoute("/api/clinical/v1/encounters/$id/orders/electrophysiology")({
  server: { handlers: orderRouteHandlers({
    headerTable: "electrophysiology_order",
    itemTable: "ep_order_item",
    audit: "ep_order",
    createSchema: EpOrderCreate,
    postRoles: ["physician"],
    itemToRow: (it) => ({
      service_id: it.service_id ?? null,
      study_type: it.study_type ?? null,
    }),
    resolveRef: (it) => ({ source: "service", serviceId: it.service_id ?? null, quantity: it.quantity ?? 1 }),
  }) },
});