import { createFileRoute } from "@tanstack/react-router";
import { preflight, requireTenant, serviceClient } from "@/lib/api-clinical";
import { encounterToFhirEncounter } from "@/lib/mds/fhir/encounter";
import { diagnosisToFhirCondition } from "@/lib/mds/fhir/condition";
import { vitalsToFhirBundle } from "@/lib/mds/fhir/observation";
import { supportingInfoToFhir } from "@/lib/mds/fhir/supporting-info";
import { envelope, jsonData, loadOwned } from "./_helpers";

export const Route = createFileRoute("/api/clinical/v1/encounters/$id/fhir")({
  server: {
    handlers: {
      OPTIONS: () => preflight(),
      GET: async ({ request, params }) => {
        const auth = await requireTenant(request);
        if (!auth.ok) return auth.res;
        type EncounterRow = {
          tenant_id: string;
          beneficiary_id: string;
          status: string;
          class: string;
          period_start: string | null;
          period_end: string | null;
          reason_text: string | null;
          episode_of_care_id: string | null;
          id: string;
        };
        const owned = await loadOwned<EncounterRow>("encounter", params.id, auth.ctx.tenantId);
        if (!owned.ok) return owned.res;
        const db = serviceClient();
        const [careTeam, diagnoses, vitals, supporting, hosp, emer] = await Promise.all([
          db.from("encounter_care_team").select("*").eq("encounter_id", params.id),
          db.from("encounter_diagnosis").select("*").eq("encounter_id", params.id),
          db.from("vitals_observation").select("*").eq("encounter_id", params.id),
          db.from("clinical_supporting_info").select("*").eq("encounter_id", params.id),
          db.from("encounter_hospitalization").select("*").eq("encounter_id", params.id).maybeSingle(),
          db.from("encounter_emergency").select("*").eq("encounter_id", params.id).maybeSingle(),
        ]);
        if (careTeam.error) return envelope(careTeam.error.message, "db_error", 500);

        const patientRef = `Patient/${owned.row.beneficiary_id}`;
        const encounterRef = `Encounter/${owned.row.id}`;

        const fhirEncounter = encounterToFhirEncounter(
          owned.row as never,
          (careTeam.data ?? []) as never,
          (diagnoses.data ?? []) as never,
          patientRef,
          (hosp.data ?? null) as never,
          (emer.data ?? null) as never,
        );
        const conditions = (diagnoses.data ?? []).map((d) =>
          diagnosisToFhirCondition(d as never, patientRef, encounterRef),
        );
        const observations = (vitals.data ?? []).flatMap((v) =>
          vitalsToFhirBundle(v as never, patientRef, encounterRef),
        );
        const supportingInfo = supportingInfoToFhir(
          (supporting.data ?? []) as never,
          patientRef,
          encounterRef,
        );

        return jsonData({
          encounter: fhirEncounter,
          conditions,
          observations,
          supporting_info: supportingInfo,
        });
      },
    },
  },
});