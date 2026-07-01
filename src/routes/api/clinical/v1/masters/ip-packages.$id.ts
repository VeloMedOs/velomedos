import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { itemHandlers } from "./_crud";

const Update = z.object({
  package_code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  package_type: z.enum(["day_case","hospital_stay"]).optional(),
  duration_days: z.number().int().min(0).optional(),
  room_type: z.string().nullable().optional(),
  price_minor: z.number().int().min(0).optional(),
  currency: z.string().optional(),
  inclusions: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  notes: z.string().nullable().optional(),
}).strict();

export const Route = createFileRoute("/api/clinical/v1/masters/ip-packages/$id")({
  server: { handlers: itemHandlers({
    table: "ip_package", audit: "ip_package", updateSchema: Update,
  }) },
});