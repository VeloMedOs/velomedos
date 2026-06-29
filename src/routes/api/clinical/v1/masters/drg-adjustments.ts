import { createFileRoute } from "@tanstack/react-router";
import { DrgPriceAdjustmentCreate } from "@/lib/mds/schema/masters";
import { listCreateHandlers } from "./_crud";
import { assertMasterOwnership } from "../_helpers";

export const Route = createFileRoute("/api/clinical/v1/masters/drg-adjustments")({
  server: { handlers: listCreateHandlers({
    table: "drg_price_adjustment", audit: "drg_adjustment", createSchema: DrgPriceAdjustmentCreate,
    filterKeys: ["payer_id", "drg_version", "adj_type", "active"],
    validateRefs: async (body, tid) => assertMasterOwnership("payer", body.payer_id, tid),
  }) },
});