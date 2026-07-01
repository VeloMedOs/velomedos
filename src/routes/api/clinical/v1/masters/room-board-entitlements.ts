import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { listCreateHandlers } from "./_crud";

const Create = z.object({
  class_id: z.string().uuid(),
  room_type: z.string().min(1),
  tier: z.number().int().min(1).default(1),
  daily_rate_minor: z.number().int().min(0).default(0),
  covered: z.boolean().optional(),
  upgrade_allowed: z.boolean().optional(),
  currency: z.string().default("SAR"),
  active: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/masters/room-board-entitlements")({
  server: { handlers: listCreateHandlers({
    table: "room_board_entitlement", audit: "room_board_entitlement",
    createSchema: Create,
    filterKeys: ["class_id","room_type","active"],
  }) },
});