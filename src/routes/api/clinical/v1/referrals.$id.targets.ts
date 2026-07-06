import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalModule, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody } from "./_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const Body = z.object({
  provider_id: z.string().uuid().nullish(),
  provider_name: z.string().nullish(),
  contact_channel: z.string().nullish(),
  contact_ref: z.string().nullish(),
});
const parse = parseBody((raw) => Body.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/referrals/$id/targets")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireTenant(request);
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("referral", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      const db = serviceClient() as any;
      const { data } = await db.from("referral_target").select("*").eq("referral_id", params.id);
      return jsonData({ data: data ?? [] });
    },
    POST: async ({ request, params }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility", { capId: "referral.write" });
      if (!auth.ok) return auth.res;
      const owned = await loadOwned<any>("referral", params.id, auth.ctx.tenantId);
      if (!owned.ok) return owned.res;
      const parsed = await parse(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const { data, error } = await db.from("referral_target").insert({
        tenant_id: auth.ctx.tenantId, referral_id: params.id, ...parsed.data,
      }).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "referral.target.create", "referral_target", data.id);
      return jsonData({ data }, 201);
    },
  } },
});