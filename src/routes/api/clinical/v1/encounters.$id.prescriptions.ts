import { createFileRoute } from "@tanstack/react-router";
import { PrescriptionCreate } from "@/lib/mds/schema/orders";
import { orderRouteHandlers } from "./_order-factory";
import { validatePrescriptionItem } from "@/lib/rcm/pbm-engine";
import { envelope } from "./_helpers";
import { serviceClient } from "@/lib/api-clinical";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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
    hooks: {
      preCreate: async (ctx, item) => {
        const override = item.indication_override === true;
        const supabase = serviceClient() as unknown as SupabaseClient<Database>;
        const res = await validatePrescriptionItem(supabase, {
          tenantId: ctx.tenantId,
          drugId: item.drug_id ?? null,
          override,
          encounterId: ctx.encounterId,
          actorId: ctx.userId,
        });
        if (!res.ok && res.code === "INDICATION_MISSING") {
          return envelope("PBM indication missing", "INDICATION_MISSING", 422);
        }
      },
    },
  }) },
});