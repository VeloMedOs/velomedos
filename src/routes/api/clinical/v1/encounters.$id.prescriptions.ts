import { createFileRoute } from "@tanstack/react-router";
import { PrescriptionCreate } from "@/lib/mds/schema/orders";
import { orderRouteHandlers } from "./_order-factory";

export const Route = createFileRoute("/api/clinical/v1/encounters/$id/prescriptions")({
  server: { handlers: orderRouteHandlers({
    headerTable: "prescription",
    itemTable: "prescription_item",
    audit: "prescription",
    createSchema: PrescriptionCreate,
    postRoles: ["physician"],
    itemToRow: (it) => ({
      drug_id: it.drug_id,
      dose: it.dose ?? null,
      frequency: it.frequency ?? null,
      duration: it.duration ?? null,
      quantity: it.quantity ?? 1,
      quantity_code: it.quantity_code ?? null,
      selection_reason: it.selection_reason ?? null,
      substitute_drug_id: it.substitute_drug_id ?? null,
    }),
    resolveRef: (it) => ({ source: "drug", drugId: it.drug_id, quantity: it.quantity ?? 1 }),
  }) },
});