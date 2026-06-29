import { createFileRoute } from "@tanstack/react-router";
import { NotCoveredRuleCreate } from "@/lib/mds/schema/rcm";
import { listCreateHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/not-covered-rules")({
  server: { handlers: listCreateHandlers({
    table: "not_covered_rule", audit: "not_covered_rule",
    createSchema: NotCoveredRuleCreate,
    filterKeys: ["payer_id", "policy_id", "class_id", "scope", "active"],
  }) },
});