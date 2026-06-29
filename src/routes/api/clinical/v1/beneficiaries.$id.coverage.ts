import { createFileRoute } from "@tanstack/react-router";
import {
  clinicalAudit,
  preflight,
  requireClinicalRole,
  requireTenant,
  serviceClient,
} from "@/lib/api-clinical";
import { CoverageCreate } from "@/lib/mds/schema/registration";
import { envelope, parseBody, assertMasterOwnership } from "./_helpers";

const parseCreate = parseBody((raw) => CoverageCreate.parse(raw));

export const Route = createFileRoute("/api/clinical/v1/beneficiaries/$id/coverage")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const db = serviceClient();
        const { data: ben } = await db
          .from("beneficiary")
          .select("id, tenant_id")
          .eq("id", params.id)
          .maybeSingle();
        if (!ben || ben.tenant_id !== auth.ctx.tenantId) {
          return envelope("Beneficiary not found", "not_found", 404);
        }
        const { data: coverages, error } = await db
          .from("coverage")
          .select("*")
          .eq("beneficiary_id", params.id)
          .eq("tenant_id", auth.ctx.tenantId)
          .order("created_at", { ascending: false });
        if (error) return envelope(error.message, "db_error", 500);
        const ids = (coverages ?? []).map((c) => c.id);
        const classesRes = ids.length
          ? await db.from("coverage_class").select("*").in("coverage_id", ids)
          : { data: [] as Array<Record<string, unknown> & { coverage_id: string }> };
        const classes = (classesRes.data ?? []) as Array<Record<string, unknown> & { coverage_id: string }>;
        const grouped = (coverages ?? []).map((c) => ({
          coverage: c,
          classes: classes.filter((k) => k.coverage_id === c.id),
        }));
        return new Response(JSON.stringify({ data: grouped }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
      POST: async ({ request, params }) => {
        const auth = await requireClinicalRole(request, ["registrar"]);
        if (!auth.ok) return auth.res;
        const parsed = await parseCreate(request);
        if (!parsed.ok) return parsed.res;

        const db = serviceClient();
        const { data: ben } = await db
          .from("beneficiary")
          .select("id, tenant_id")
          .eq("id", params.id)
          .maybeSingle();
        if (!ben || ben.tenant_id !== auth.ctx.tenantId) {
          return envelope("Beneficiary not found", "not_found", 404);
        }

        const { classes, ...coverageInput } = parsed.data;
        // Phase-3: validate master FK references belong to this tenant.
        for (const [table, id] of [
          ["payer", coverageInput.payer_id],
          ["tpa", coverageInput.tpa_id],
          ["policy", coverageInput.policy_id],
          ["insurance_plan", coverageInput.insurance_plan_id],
          ["network", coverageInput.network_id],
        ] as const) {
          const err = await assertMasterOwnership(table, id, auth.ctx.tenantId);
          if (err) return err;
        }
        const { data: coverage, error } = await db
          .from("coverage")
          .insert({
            ...coverageInput,
            beneficiary_id: params.id,
            tenant_id: auth.ctx.tenantId,
            created_by: auth.ctx.userId,
            updated_by: auth.ctx.userId,
          })
          .select("*")
          .single();
        if (error) return envelope(error.message, "db_error", 500);

        let insertedClasses: unknown[] = [];
        if (classes && classes.length) {
          const { data: kData, error: kErr } = await db
            .from("coverage_class")
            .insert(
              classes.map((c) => ({
                ...c,
                coverage_id: coverage.id,
                tenant_id: auth.ctx.tenantId,
              })),
            )
            .select("*");
          if (kErr) {
            await db.from("coverage").delete().eq("id", coverage.id);
            return envelope(kErr.message, "db_error", 500);
          }
          insertedClasses = kData ?? [];
        }

        await clinicalAudit(auth.ctx.userId, auth.ctx.tenantId, "coverage.create", "coverage", coverage.id);
        return new Response(
          JSON.stringify({ data: { coverage, classes: insertedClasses } }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
