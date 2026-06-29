import { createFileRoute } from "@tanstack/react-router";
import {
  clinicalAudit, preflight, requireClinicalModule, serviceClient,
} from "@/lib/api-clinical";
import { envelope, jsonData, parseBody, assertMasterOwnership } from "./_helpers";
import { PolicyActivationCreate } from "@/lib/mds/schema/rcm";
import { applyEvent } from "@/lib/rcm/eligibility-engine";

/* eslint-disable @typescript-eslint/no-explicit-any */
const parseCreate = parseBody((raw) => PolicyActivationCreate.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/policy-activations")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility");
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      let q: any = (serviceClient() as any).from("policy_activation_request")
        .select("*", { count: "exact" })
        .eq("tenant_id", auth.ctx.tenantId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      for (const k of ["status", "visit_eligibility_id", "assigned_to"]) {
        const v = url.searchParams.get(k);
        if (v !== null && v !== "") q = q.eq(k, v);
      }
      const { data, count, error } = await q;
      if (error) return envelope(error.message, "db_error", 500);
      return jsonData({ data: data ?? [], pagination: { limit, offset, total: count ?? 0 } });
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalModule(request, "Registration & Eligibility", { capId: "reg.activation" });
      if (!auth.ok) return auth.res;
      const parsed = await parseCreate(request);
      if (!parsed.ok) return parsed.res;
      const veErr = await assertMasterOwnership("visit_eligibility", parsed.data.visit_eligibility_id, auth.ctx.tenantId);
      if (veErr) return veErr;
      const db = serviceClient() as any;
      const { data, error } = await db.from("policy_activation_request").insert({
        tenant_id: auth.ctx.tenantId,
        ...parsed.data,
        requested_by: auth.ctx.userId,
        created_by: auth.ctx.userId,
        updated_by: auth.ctx.userId,
      }).select("*").single();
      if (error) return envelope(error.message, "db_error", 400);
      const moved = await applyEvent(parsed.data.visit_eligibility_id,
        { kind: "activation.request" },
        { userId: auth.ctx.userId, tenantId: auth.ctx.tenantId });
      if (!moved.ok) return envelope(moved.error, moved.code, moved.status ?? 409);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId,
        "policy_activation_request.create", "policy_activation_request", data.id);
      return jsonData({ data: { request: data, visit_eligibility: moved.row } }, 201);
    },
  } },
});