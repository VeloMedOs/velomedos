import { createFileRoute } from "@tanstack/react-router";
import { LabOrderCreate } from "@/lib/mds/schema/orders";
import { orderRouteHandlers } from "./_order-factory";

export const Route = createFileRoute("/api/clinical/v1/encounters/$id/orders/lab")({
  server: { handlers: orderRouteHandlers({
    headerTable: "lab_order",
    itemTable: "lab_order_item",
    audit: "lab_order",
    createSchema: LabOrderCreate,
    postRoles: ["lab_tech", "physician"],
    itemToRow: (it) => ({
      service_id: it.service_id ?? null,
      loinc_code: it.loinc_code ?? null,
      specimen: it.specimen ?? null,
    }),
    resolveRef: (it) => ({ source: "service", serviceId: it.service_id ?? null, quantity: it.quantity ?? 1 }),
  }) },
});