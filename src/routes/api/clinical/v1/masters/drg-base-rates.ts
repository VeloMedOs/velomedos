import { createFileRoute } from "@tanstack/react-router";
import { DrgBaseRateCreate } from "@/lib/mds/schema/masters";
import { listCreateHandlers } from "./_crud";
import { assertMasterOwnership } from "../_helpers";

export const Route = createFileRoute("/api/clinical/v1/masters/drg-base-rates")({
  server: { handlers: listCreateHandlers({
    table: "drg_base_rate", audit: "drg_base_rate", createSchema: DrgBaseRateCreate,
    filterKeys: ["payer_id", "network_id", "drg_version"],
    validateRefs: async (body, tid) => {
      const p = await assertMasterOwnership("payer", body.payer_id, tid);
      if (p) return p;
      return assertMasterOwnership("network", body.network_id, tid);
    },
  }) },
});