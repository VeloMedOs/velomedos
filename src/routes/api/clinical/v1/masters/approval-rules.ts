import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { listCreateHandlers } from "./_crud";

/**
 * R2 — auto-decision rule master (direct CRUD, NOT change-request governed
 * per FIX 3). Rows here are operational config that Approval Officers tune
 * without contract-scope guardrails.
 */
const ApprovalRuleCreate = z.object({
  payer_id: z.string().uuid().nullable().optional(),
  policy_id: z.string().uuid().nullable().optional(),
  class_id: z.string().uuid().nullable().optional(),
  scope: z.string(),
  condition: z.record(z.string(), z.unknown()).default({}),
  auto_decision: z.enum(["approve", "partial", "reject", "review"]).default("review"),
  default_valid_days: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/masters/approval-rules")({
  server: { handlers: listCreateHandlers({
    table: "approval_rule",
    audit: "approval_rule",
    createSchema: ApprovalRuleCreate,
    filterKeys: ["payer_id", "policy_id", "class_id", "scope", "active"],
  }) },
});