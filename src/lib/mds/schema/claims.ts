/**
 * Phase 7 — Claim assembly + submission payloads.
 */
import { z } from "zod";

export const ClaimAssembleRequest = z.object({
  force: z.boolean().optional(),
  provider_claim_no: z.string().trim().min(1).max(64).optional(),
  invoice_no: z.string().trim().max(64).optional().nullable(),
  claim_type: z
    .enum(["professional", "institutional", "pharmacy", "oral", "vision"])
    .optional(),
});
export type ClaimAssembleRequestInput = z.infer<typeof ClaimAssembleRequest>;

export const ClaimUpdate = z.object({
  invoice_no: z.string().trim().max(64).optional().nullable(),
  provider_claim_no: z.string().trim().min(1).max(64).optional(),
}).partial();
export type ClaimUpdateInput = z.infer<typeof ClaimUpdate>;

export const ClaimSubmitRequest = z.object({
  note: z.string().trim().max(2000).optional().nullable(),
});
export type ClaimSubmitRequestInput = z.infer<typeof ClaimSubmitRequest>;