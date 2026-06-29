import { createFileRoute } from "@tanstack/react-router";
import { RadiologyOrderCreate } from "@/lib/mds/schema/orders";
import { orderRouteHandlers } from "./_order-factory";

export const Route = createFileRoute("/api/clinical/v1/encounters/$id/orders/radiology")({
  server: { handlers: orderRouteHandlers({
    headerTable: "radiology_order",
    itemTable: "radiology_order_item",
    audit: "radiology_order",
    createSchema: RadiologyOrderCreate,
    postRoles: ["radiologist", "physician"],
    itemToRow: (it) => ({
      service_id: it.service_id ?? null,
      modality: it.modality ?? null,
      body_site: it.body_site ?? null,
    }),
    resolveRef: (it) => ({ source: "service", serviceId: it.service_id ?? null, quantity: it.quantity ?? 1, bodySite: it.body_site ?? null }),
  }) },
});