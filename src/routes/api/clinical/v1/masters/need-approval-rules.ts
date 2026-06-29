import { createFileRoute } from "@tanstack/react-router";
import { NeedApprovalRuleCreate } from "@/lib/mds/schema/rcm";
import { listCreateHandlers } from "./_crud";

export const Route = createFileRoute("/api/clinical/v1/masters/need-approval-rules")({
  server: { handlers: listCreateHandlers({
    table: "need_approval_rule", audit: "need_approval_rule",
    createSchema: NeedApprovalRuleCreate,
    filterKeys: ["payer_id", "policy_id", "class_id", "scope", "active"],
  }) },
});