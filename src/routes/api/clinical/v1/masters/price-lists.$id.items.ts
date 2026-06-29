import { createFileRoute } from "@tanstack/react-router";
import { PriceListItemCreate } from "@/lib/mds/schema/masters";
import { childListCreate } from "./_crud";
import { assertMasterOwnership } from "../_helpers";
import { preflight } from "@/lib/api-clinical";

export const Route = createFileRoute("/api/clinical/v1/masters/price-lists/$id/items")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => childListCreate({
        request, parentId: params.id, parentTable: "price_list", parentFkColumn: "price_list_id",
        childTable: "price_list_item", audit: "price_list_item", createSchema: PriceListItemCreate,
        filterKeys: ["service_id", "drug_id", "is_package"],
      }),
      POST: async ({ request, params }) => childListCreate({
        request, parentId: params.id, parentTable: "price_list", parentFkColumn: "price_list_id",
        childTable: "price_list_item", audit: "price_list_item", createSchema: PriceListItemCreate,
        validateRefs: async (body, tid) => {
          const s = await assertMasterOwnership("service_master", body.service_id, tid);
          if (s) return s;
          return assertMasterOwnership("drug_master", body.drug_id, tid);
        },
      }),
    },
  },
});