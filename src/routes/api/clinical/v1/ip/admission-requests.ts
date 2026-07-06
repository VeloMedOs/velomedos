import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalRole, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, parseBody, assertMasterOwnership } from "../_helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const Create = z.object({
  encounter_id: z.string().uuid(),
  request_type: z.enum(["surgery","procedure","cath","medical","day_case"]).default("medical"),
  package_id: z.string().uuid().nullable().optional(),
  mrp_id: z.string().uuid().nullable().optional(),
  room_type_entitled: z.string().nullable().optional(),
  requested_deposit_minor: z.number().int().min(0).optional(),
  reasons_triggered: z.array(z.string()).optional(),
});

export const Route = createFileRoute("/api/clinical/v1/ip/admission-requests")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request }) => {
      const auth = await requireTenant(request);
      if (!auth.ok) return auth.res;
      const url = new URL(request.url);
      const limit  = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
      const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
      const status = url.searchParams.get("status");
      const q      = url.searchParams.get("q");
      const encId  = url.searchParams.get("encounter_id");
      let sel: any = (serviceClient() as any).from("admission_request")
        .select("*", { count: "exact" })
        .eq("tenant_id", auth.ctx.tenantId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (status) sel = sel.eq("status", status);
      if (encId)  sel = sel.eq("encounter_id", encId);
      if (q)      sel = sel.or(`admission_no.ilike.%${q}%,admission_serial.ilike.%${q}%`);
      const { data, count, error } = await sel;
      if (error) return envelope("database_error", "db_error", 500);
      return jsonData({ data: data ?? [], pagination: { limit, offset, total: count ?? 0 } });
    },
    POST: async ({ request }) => {
      const auth = await requireClinicalRole(request, ["tenant_admin","rcm","case_manager","registrar","front_office","physician"]);
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Create.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const db = serviceClient() as any;
      const encErr = await assertMasterOwnership("encounter", parsed.data.encounter_id, auth.ctx.tenantId);
      if (encErr) return encErr;
      if (parsed.data.package_id) {
        const pkErr = await assertMasterOwnership("ip_package", parsed.data.package_id, auth.ctx.tenantId);
        if (pkErr) return pkErr;
      }
      const { data: enc } = await db.from("encounter")
        .select("beneficiary_id, coverage_id").eq("id", parsed.data.encounter_id).maybeSingle();
      const { data: cov } = enc?.coverage_id
        ? await db.from("coverage").select("payer_id, policy_id, class_id, network_id").eq("id", enc.coverage_id).maybeSingle()
        : { data: null };
      const { data: elig } = await db.from("visit_eligibility")
        .select("id").eq("tenant_id", auth.ctx.tenantId).eq("encounter_id", parsed.data.encounter_id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();

      const insertRow: Record<string, unknown> = {
        tenant_id: auth.ctx.tenantId,
        encounter_id: parsed.data.encounter_id,
        request_type: parsed.data.request_type,
        package_id: parsed.data.package_id ?? null,
        mrp_id: parsed.data.mrp_id ?? null,
        room_type_entitled: parsed.data.room_type_entitled ?? null,
        requested_deposit_minor: parsed.data.requested_deposit_minor ?? 0,
        beneficiary_id: enc?.beneficiary_id ?? null,
        coverage_id: enc?.coverage_id ?? null,
        eligibility_ref: elig?.id ?? null,
        payer_id: cov?.payer_id ?? null,
        policy_id: cov?.policy_id ?? null,
        class_id: cov?.class_id ?? null,
        network_id: cov?.network_id ?? null,
        reasons_triggered: parsed.data.reasons_triggered ?? [],
        status: "requested",
        created_by: auth.ctx.userId,
        updated_by: auth.ctx.userId,
      };
      const { data, error } = await db.from("admission_request").insert(insertRow).select("*").single();
      if (error) return envelope("database_error", "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "admission_request.create", "admission_request", data.id);
      return jsonData({ data }, 201);
    },
  } },
});