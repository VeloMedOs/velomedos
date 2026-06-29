import { createFileRoute } from "@tanstack/react-router";
import { PrescriptionItemUpdate } from "@/lib/mds/schema/orders";
import { orderItemHandlers } from "../_order-factory";

export const Route = createFileRoute("/api/clinical/v1/orders/prescription-items/$id")({
  server: { handlers: orderItemHandlers({
    table: "prescription_item", audit: "prescription_item",
    updateSchema: PrescriptionItemUpdate, patchRoles: ["pharmacist", "physician"],
  }) },
});