import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clinicalAudit, preflight, requireClinicalRole, requireTenant, serviceClient } from "@/lib/api-clinical";
import { envelope, jsonData, loadOwned, parseBody } from "../_helpers";
import { readiness, bucketOfAdmission } from "@/lib/rcm/ip-accounting-sm";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Only tunable fields — status/serial/paid_amount are governed by action routes.
const Patch = z.object({
  request_type: z.enum(["surgery","procedure","cath","medical","day_case"]).optional(),
  mrp_id: z.string().uuid().nullable().optional(),
  package_id: z.string().uuid().nullable().optional(),
  room_type_entitled: z.string().nullable().optional(),
  los_days: z.number().int().min(0).nullable().optional(),
  edd: z.string().nullable().optional(),
  requested_deposit_minor: z.number().int().min(0).optional(),
  consent_id: z.string().uuid().nullable().optional(),
  admission_source: z.string().nullable().optional(),
  reasons_triggered: z.array(z.string()).optional(),
}).strict();

export const Route = createFileRoute("/api/clinical/v1/ip/admission-requests/$id")({
  server: { handlers: {
    OPTIONS: () => preflight(),
    GET: async ({ request, params }) => {
      const auth = await requireTenant(request);
      if (!auth.ok) return auth.res;
      const own = await loadOwned<any>("admission_request", params.id, auth.ctx.tenantId);
      if (!own.ok) return own.res;
      const db = serviceClient() as any;
      const [transfers, losExts, deposits, auths] = await Promise.all([
        db.from("bed_transfer").select("*").eq("admission_request_id", params.id).order("created_at"),
        db.from("los_extension").select("*").eq("admission_request_id", params.id).order("created_at"),
        db.from("deposit").select("*").eq("admission_request_id", params.id).order("created_at"),
        db.from("authorization_request").select("id, status, auth_scope, valid_from, valid_to")
          .eq("admission_request_id", params.id).order("created_at"),
      ]);
      // Room-board coverage lookup for readiness.
      let hasCoveredBed: boolean | undefined;
      if (own.row.class_id && own.row.room_type_entitled) {
        const { data: rbe } = await db.from("room_board_entitlement")
          .select("id, covered").eq("tenant_id", auth.ctx.tenantId)
          .eq("class_id", own.row.class_id).eq("room_type", own.row.room_type_entitled).maybeSingle();
        hasCoveredBed = !!(rbe && rbe.covered);
      }
      const hasApprovedPackageAuth = (auths.data ?? []).some((a: any) =>
        a.auth_scope === "package" && ["approved","partially_approved"].includes(String(a.status)));
      // Count open orders (charge_item with executed=false / status='ordered').
      const { count: openOrders } = await db.from("charge_item")
        .select("id", { count: "exact", head: true })
        .eq("admission_request_id", params.id).eq("status", "ordered");
      const rd = readiness({ row: own.row, hasCoveredBed, hasApprovedPackageAuth, openOrders: openOrders ?? 0 });
      return jsonData({
        data: {
          row: own.row,
          bucket: bucketOfAdmission(own.row),
          readiness: rd,
          transfers: transfers.data ?? [],
          los_extensions: losExts.data ?? [],
          deposits: deposits.data ?? [],
          authorizations: auths.data ?? [],
        },
      });
    },
    PATCH: async ({ request, params }) => {
      const auth = await requireClinicalRole(request, ["tenant_admin","rcm","case_manager","cashier","front_office"]);
      if (!auth.ok) return auth.res;
      const parsed = await parseBody((raw) => Patch.parse(raw))(request);
      if (!parsed.ok) return parsed.res;
      const own = await loadOwned<any>("admission_request", params.id, auth.ctx.tenantId);
      if (!own.ok) return own.res;
      if (["discharged","cancelled"].includes(own.row.status)) {
        return envelope("Admission is terminal", "invalid_state", 409);
      }
      const db = serviceClient() as any;
      const { data, error } = await db.from("admission_request")
        .update({ ...parsed.data, updated_by: auth.ctx.userId })
        .eq("id", params.id).select("*").single();
      if (error) return envelope(error.message, "db_error", 400);
      await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "admission_request.update", "admission_request", params.id);
      return jsonData({ data });
    },
  } },
});