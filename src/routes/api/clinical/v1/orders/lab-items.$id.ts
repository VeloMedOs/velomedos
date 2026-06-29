import { createFileRoute } from "@tanstack/react-router";
import { LabItemUpdate } from "@/lib/mds/schema/orders";
import { orderItemHandlers } from "../_order-factory";

export const Route = createFileRoute("/api/clinical/v1/orders/lab-items/$id")({
  server: { handlers: orderItemHandlers({
    table: "lab_order_item", audit: "lab_order_item",
    updateSchema: LabItemUpdate, patchRoles: ["lab_tech", "physician"],
  }) },
});