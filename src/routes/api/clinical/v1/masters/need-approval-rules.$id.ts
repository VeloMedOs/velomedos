import { createFileRoute } from "@tanstack/react-router";
import { NeedApprovalRuleUpdate } from "@/lib/mds/schema/rcm";
import { itemHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/need-approval-rules/$id")({
  server: { handlers: itemHandlers({
    table: "need_approval_rule", audit: "need_approval_rule",
    updateSchema: NeedApprovalRuleUpdate,
  }) },
});