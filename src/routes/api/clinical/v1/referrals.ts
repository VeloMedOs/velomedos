import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const CreateSchema = z.object({
  beneficiary_id: z.string().uuid(),
  encounter_id: z.string().uuid().nullish(),
  source_specialty: z.string().nullish(),
  target_specialty: z.string().nullish(),
  reason: z.string().max(2000).nullish(),
  urgency: z.string().nullish(),
});
const parseCreate = parseBody((raw) => CreateSchema.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/referrals")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireTenant(request);
      if (!auth.ok) return auth.res;
      const db = serviceClient() as any;
      const { data, error } = await db.from("referral").select("*").eq("tenant_id", auth.ctx.tenantId).order("created_at", { ascending: false }).limit(200);
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: data ?? [] });
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility", { capId: "referral.write" });
      if (!auth.ok) return auth.res;
      const parsed = await parseCreate(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data, error } = await db.from("referral").insert({
        tenant_id: auth.ctx.tenantId, ...parsed.data, created_by: auth.ctx.userId,
      }).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "referral.create", "referral", data.id);
      return jsonData({ data }, 201);
    },
  } },
});