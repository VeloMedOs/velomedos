import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { listCreateHandlers } from "./_crud";

const Create = z.object({
  package_code: z.string().min(1),
  name: z.string().min(1),
  package_type: z.enum(["day_case","hospital_stay"]).default("hospital_stay"),
  duration_days: z.number().int().min(0).default(1),
  room_type: z.string().nullable().optional(),
  price_minor: z.number().int().min(0).default(0),
  currency: z.string().default("SAR"),
  inclusions: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export const Route = createFileRoute("/api/clinical/v1/masters/ip-packages")({
  server: { handlers: listCreateHandlers({
    table: "ip_package", audit: "ip_package",
    createSchema: Create,
    filterKeys: ["package_type","active"],
  }) },
});