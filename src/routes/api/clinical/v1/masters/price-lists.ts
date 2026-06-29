import { createFileRoute } from "@tanstack/react-router";
import { PriceListCreate } from "@/lib/mds/schema/masters";
import { listCreateHandlers } from "./_crud";
import { assertMasterOwnership } from "../_helpers";

export const Route = createFileRoute("/api/clinical/v1/masters/price-lists")({
  server: { handlers: listCreateHandlers({
    table: "price_list", audit: "price_list", createSchema: PriceListCreate,
    filterKeys: ["list_type", "payer_id", "network_id", "active"],
    validateRefs: async (body, tid) => {
      const p = await assertMasterOwnership("payer", body.payer_id, tid);
      if (p) return p;
      return assertMasterOwnership("network", body.network_id, tid);
    },
  }) },
});