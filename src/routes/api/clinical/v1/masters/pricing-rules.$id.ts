import { createFileRoute } from "@tanstack/react-router";
import { PricingRuleUpdate } from "@/lib/mds/schema/orders";
import { itemHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/pricing-rules/$id")({
  server: { handlers: itemHandlers({
    table: "pricing_rule", audit: "pricing_rule", updateSchema: PricingRuleUpdate,
  }) },
});