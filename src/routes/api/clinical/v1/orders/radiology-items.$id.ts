import { createFileRoute } from "@tanstack/react-router";
import { RadiologyItemUpdate } from "@/lib/mds/schema/orders";
import { orderItemHandlers } from "../_order-factory";

export const Route = createFileRoute("/api/clinical/v1/orders/radiology-items/$id")({
  server: { handlers: orderItemHandlers({
    table: "radiology_order_item", audit: "radiology_order_item",
    updateSchema: RadiologyItemUpdate, patchRoles: ["radiologist", "physician"],
  }) },
});