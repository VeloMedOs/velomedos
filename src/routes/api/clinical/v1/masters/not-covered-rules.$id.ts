import { createFileRoute } from "@tanstack/react-router";
import { NotCoveredRuleUpdate } from "@/lib/mds/schema/rcm";
import { itemHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/not-covered-rules/$id")({
  server: { handlers: itemHandlers({
    table: "not_covered_rule", audit: "not_covered_rule",
    updateSchema: NotCoveredRuleUpdate,
  }) },
});