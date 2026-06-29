import { createFileRoute } from "@tanstack/react-router";
import { PricingRuleCreate } from "@/lib/mds/schema/orders";
import { listCreateHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/pricing-rules")({
  server: { handlers: listCreateHandlers({
    table: "pricing_rule", audit: "pricing_rule", createSchema: PricingRuleCreate,
    filterKeys: ["scope", "active"],
  }) },
});