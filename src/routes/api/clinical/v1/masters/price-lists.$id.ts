import { createFileRoute } from "@tanstack/react-router";
import { PriceListUpdate } from "@/lib/mds/schema/masters";
import { itemHandlers } from "./_crud";
import { assertMasterOwnership } from "../_helpers";

export const Route = createFileRoute("/api/clinical/v1/masters/price-lists/$id")({
  server: { handlers: itemHandlers({
    table: "price_list", audit: "price_list", updateSchema: PriceListUpdate,
    validateRefs: async (body, tid) => {
      const p = await assertMasterOwnership("payer", body.payer_id, tid);
      if (p) return p;
      return assertMasterOwnership("network", body.network_id, tid);
    },
  }) },
});