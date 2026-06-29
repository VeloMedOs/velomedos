/**
 * Phase 6 — Coder finalization + AR-DRG grouper run payloads.
 */
import { z } from "zod";

export const CodingFinalize = z.object({
  principal_diagnosis_id: z.string().uuid(),
  notes: z.string().trim().max(4000).optional().nullable(),
});
export type CodingFinalizeInput = z.infer<typeof CodingFinalize>;

export const GrouperRunRequest = z.object({
  force: z.boolean().optional(),
});
export type GrouperRunRequestInput = z.infer<typeof GrouperRunRequest>;