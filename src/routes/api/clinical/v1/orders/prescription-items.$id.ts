import { createFileRoute } from "@tanstack/react-router";
import { PrescriptionItemUpdate } from "@/lib/mds/schema/orders";
import { orderItemHandlers } from "../_order-factory";
import { validatePrescriptionItem } from "@/lib/rcm/pbm-engine";
import { envelope } from "../_helpers";
import { serviceClient } from "@/lib/api-clinical";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/clinical/v1/orders/prescription-items/$id")({
  server: { handlers: orderItemHandlers({
    table: "prescription_item", audit: "prescription_item",
    updateSchema: PrescriptionItemUpdate, patchRoles: ["pharmacist", "physician"],
    hooks: {
      prePatch: async (ctx, patch) => {
        const override = patch?.indication_override === true;
        // Resolve drug_id + encounter_id via prescription_item → prescription.
        const { data: item } = await (ctx.db as any)
          .from("prescription_item")
          .select("drug_id, order_id")
          .eq("id", ctx.itemId).maybeSingle();
        if (!item) return;
        const { data: header } = await (ctx.db as any)
          .from("prescription").select("encounter_id").eq("id", item.order_id).maybeSingle();
        // Resolve charge_item id linked to this order item (for exception row).
        const { data: charge } = await (ctx.db as any)
          .from("charge_item")
          .select("id")
          .eq("order_item_table", "prescription_item")
          .eq("order_item_id", ctx.itemId)
          .maybeSingle();
        const supabase = serviceClient() as unknown as SupabaseClient<Database>;
        const res = await validatePrescriptionItem(supabase, {
          tenantId: ctx.tenantId,
          drugId: (item as any).drug_id ?? null,
          override,
          encounterId: (header as any)?.encounter_id ?? null,
          chargeItemId: (charge as any)?.id ?? null,
          actorId: ctx.userId,
        });
        if (!res.ok && res.code === "INDICATION_MISSING") {
          return envelope("PBM indication missing", "INDICATION_MISSING", 422);
        }
      },
    },
  }) },
});