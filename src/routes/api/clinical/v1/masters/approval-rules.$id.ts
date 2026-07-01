import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { itemHandlers } from "./_crud";

const ApprovalRuleUpdate = z.object({
  payer_id: z.string().uuid().nullable().optional(),
  policy_id: z.string().uuid().nullable().optional(),
  class_id: z.string().uuid().nullable().optional(),
  scope: z.string().optional(),
  condition: z.record(z.string(), z.unknown()).optional(),
  auto_decision: z.enum(["approve", "partial", "reject", "review"]).optional(),
  default_valid_days: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
  notes: z.string().nullable().optional(),
}).partial();

export const Route = createFileRoute("/api/clinical/v1/masters/approval-rules/$id")({
  server: { handlers: itemHandlers({
    table: "approval_rule",
    audit: "approval_rule",
    updateSchema: ApprovalRuleUpdate,
  }) },
});