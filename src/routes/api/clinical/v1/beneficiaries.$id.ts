import { createFileRoute } from "@tanstack/react-router";
import {
  clinicalAudit,
  preflight,
  requireClinicalRole,
  requireTenant,
  serviceClient,
} from "@/lib/api-clinical";
import { BeneficiaryUpdate } from "@/lib/mds/schema/registration";
import { envelope, parseBody } from "./_helpers";

const parseUpdate = parseBody((raw) => BeneficiaryUpdate.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/beneficiaries/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const db = serviceClient();
        const { data, error } = await db
          .from("beneficiary")
          .select("*")
          .eq("id", params.id)
          .eq("tenant_id", auth.ctx.tenantId)
          .maybeSingle();
        if (error) return envelope("database_error", "db_error", 500);
        if (!data) return envelope("Beneficiary not found", "not_found", 404);
        return new Response(JSON.stringify({ data }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
      PATCH: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["registrar"]);
        if (!auth.ok) return auth.res;
        const parsed = await parseUpdate(request);
        if (!parsed.ok) return parsed.res;

        const db = serviceClient();
        const { data: existing } = await db
          .from("beneficiary")
          .select("id, tenant_id")
          .eq("id", params.id)
          .maybeSingle();
        if (!existing || existing.tenant_id !== auth.ctx.tenantId) {
          return envelope("Beneficiary not found", "not_found", 404);
        }

        const { data, error } = await db
          .from("beneficiary")
          .update({ ...parsed.data, updated_by: auth.ctx.userId })
          .eq("id", params.id)
          .select("*")
          .single();
        if (error) return envelope("database_error", "db_error", 500);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "beneficiary.update", "beneficiary", params.id);
        return new Response(JSON.stringify({ data }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
