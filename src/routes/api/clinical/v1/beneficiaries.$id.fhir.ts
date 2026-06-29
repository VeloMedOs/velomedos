import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireTenant, serviceClient } from "@/lib/api-clinical";
import { beneficiaryToFhirPatient, type BeneficiaryRow } from "@/lib/mds/fhir/patient";
import {
  coverageToFhirCoverage,
  type CoverageRow,
  type CoverageClassRow,
} from "@/lib/mds/fhir/coverage";
import { envelope } from "./_helpers";

export const Route = createFileRoute("/api/clinical/v1/beneficiaries/$id/fhir")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        const db = serviceClient();
        const { data: ben, error } = await db
          .from("beneficiary")
          .select("*")
          .eq("id", params.id)
          .eq("tenant_id", auth.ctx.tenantId)
          .maybeSingle();
        if (error) return envelope(error.message, "db_error", 500);
        if (!ben) return envelope("Beneficiary not found", "not_found", 404);

        const { data: coverages } = await db
          .from("coverage")
          .select("*")
          .eq("beneficiary_id", params.id)
          .eq("tenant_id", auth.ctx.tenantId);
        const ids = (coverages ?? []).map((c) => c.id);
        const classesRes = ids.length
          ? await db.from("coverage_class").select("*").in("coverage_id", ids)
          : { data: [] as CoverageClassRow[] };
        const classes = (classesRes.data ?? []) as unknown as CoverageClassRow[];

        const patient = beneficiaryToFhirPatient(ben as unknown as BeneficiaryRow);
        const patientRef = `Patient/${ben.id}`;
        const fhirCoverages = (coverages ?? []).map((c) =>
          coverageToFhirCoverage(
            c as unknown as CoverageRow,
            classes.filter((k) => k.coverage_id === c.id),
            patientRef,
          ),
        );

        return new Response(
          JSON.stringify({ patient, coverages: fhirCoverages }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
