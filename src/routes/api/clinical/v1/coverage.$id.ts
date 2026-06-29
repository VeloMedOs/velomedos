import { createFileRoute } from "@tanstack/react-router";
import {
  clinicalAudit,
  preflight,
  requireClinicalRole,
  requireTenant,
  serviceClient,
} from "@/lib/api-clinical";
import { CoverageUpdate } from "@/lib/mds/schema/registration";
import { envelope, parseBody, assertMasterOwnership } from "./_helpers";

const parseUpdate = parseBody((raw) => CoverageUpdate.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/coverage/$id")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const db = serviceClient();
        const { data, error } = await db
          .from("coverage")
          .select("*")
          .eq("id", params.id)
          .eq("tenant_id", auth.ctx.tenantId)
          .maybeSingle();
        if (error) return envelope(error.message, "db_error", 500);
        if (!data) return envelope("Coverage not found", "not_found", 404);
        const { data: classes } = await db
          .from("coverage_class")
          .select("*")
          .eq("coverage_id", params.id);
        return new Response(
          JSON.stringify({ data: { coverage: data, classes: classes ?? [] } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
      PATCH: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["registrar"]);
        if (!auth.ok) return auth.res;
        const parsed = await parseUpdate(request);
        if (!parsed.ok) return parsed.res;

        const db = serviceClient();
        const { data: existing } = await db
          .from("coverage")
          .select("id, tenant_id")
          .eq("id", params.id)
          .maybeSingle();
        if (!existing || existing.tenant_id !== auth.ctx.tenantId) {
          return envelope("Coverage not found", "not_found", 404);
        }

        for (const [table, id] of [
          ["payer", parsed.data.payer_id],
          ["tpa", parsed.data.tpa_id],
          ["policy", parsed.data.policy_id],
          ["insurance_plan", parsed.data.insurance_plan_id],
          ["network", parsed.data.network_id],
        ] as const) {
          const err = await assertMasterOwnership(table, id, auth.ctx.tenantId);
          if (err) return err;
        }

        const { data, error } = await db
          .from("coverage")
          .update({ ...parsed.data, updated_by: auth.ctx.userId })
          .eq("id", params.id)
          .select("*")
          .single();
        if (error) return envelope(error.message, "db_error", 500);
        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "coverage.update", "coverage", params.id);
        return new Response(JSON.stringify({ data }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
