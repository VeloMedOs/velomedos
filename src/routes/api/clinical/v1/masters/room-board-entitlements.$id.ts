import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { itemHandlers } from "./_crud";

const Update = z.object({
  class_id: z.string().uuid().optional(),
  room_type: z.string().min(1).optional(),
  tier: z.number().int().min(1).optional(),
  daily_rate_minor: z.number().int().min(0).optional(),
  covered: z.boolean().optional(),
  upgrade_allowed: z.boolean().optional(),
  currency: z.string().optional(),
  active: z.boolean().optional(),
  notes: z.string().nullable().optional(),
}).strict();

export const Route = createFileRoute("/api/clinical/v1/masters/room-board-entitlements/$id")({
  server: { handlers: itemHandlers({
    table: "room_board_entitlement", audit: "room_board_entitlement", updateSchema: Update,
  }) },
});