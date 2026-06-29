# Phase 2 — Encounter + Diagnosis + Vitals + CareTeam (REVISED)

Builds the per-visit clinical journey on top of Phase 1's `beneficiary`/`coverage`. Standing rule applies: **API-first, fully wired** — every new table reachable through a route; no orphan tables, no stubbed handlers.

> Revision incorporates three pitfalls flagged on review: **(a)** two independent state axes on `encounter`, **(b)** restored encounter columns the master doc requires for Phase 4/5/6, **(c)** a `clinical_supporting_info` table for CHI-mandated narrative MDS that vitals can't carry.

## 1. Supabase migration — 6 tables

Tenant-scoped, RLS via `is_tenant_member`, GRANT → ENABLE RLS → POLICY, `touch_updated_at()` trigger on each.

### `episode_of_care`

`tenant_id`, `beneficiary_id fk→beneficiary ON DELETE CASCADE`, `status text NOT NULL DEFAULT 'active'` (`active|finished|cancelled`), `care_type text` (`acute|chronic|homecare|maternity|...`), `start_date date NOT NULL DEFAULT current_date`, `end_date date NULL`, `primary_practitioner_id uuid NULL`, `notes text`, standard fields. Index `(tenant_id, beneficiary_id, status)`.

### `encounter` — **two state axes** [REVISED]

Per-visit object with **both** a FHIR clinical lifecycle and the MDS/claim pipeline state. They progress independently — an encounter can be clinically `finished` while still moving through `coded → grouped → claim_ready` in billing. Phases 6/7 have nowhere to record the billing milestones without this split.

- Identity / linkage: `tenant_id`, `beneficiary_id fk→beneficiary`, `episode_of_care_id fk→episode_of_care NULL ON DELETE SET NULL`, `coverage_id fk→coverage NULL ON DELETE SET NULL`, `encounter_number text` (tenant-local human id, auto-gen), `class text NOT NULL` (`AMB|EMER|IMP|HH|VR`), `type text`, `service_type text NULL`, `priority text NULL`, `location_id uuid NULL` (Phase-3 placeholder).
- **Clinical lifecycle (FHIR-aligned):** `status text NOT NULL DEFAULT 'planned'` — `planned|arrived|triaged|in_progress|on_leave|finished|cancelled`. Driven by the `encounters.$id.advance` route via the **encounter clinical state machine**.
- **MDS pipeline (claim journey):** `journey_state text NOT NULL DEFAULT 'encounter_open'` — reuses Phase-0 `JourneyState`: `encounter_open|clinically_documented|investigations_ordered|admitted|discharged|coded|grouped|claim_ready|submitted|void`. Driven by later milestone routes (Phase 5 discharge, Phase 6 coder/grouper, Phase 7 claim builder). Not editable from Phase-2 PATCH or advance.
- Period + narrative: `period_start timestamptz NOT NULL DEFAULT now()`, `period_end timestamptz NULL`, `reason_text text NULL`, `chief_complaint text NULL`.
- **[NEW — restored from master doc]** Pricing/grouper inputs (all nullable, populated at discharge in Phase 5, read by Phase 4/6):
  - `reimbursement_model text NULL` — `drg_bundled|itemized_sbs`. Auto-derived on insert/update via a trigger: `IMP → drg_bundled`, else `itemized_sbs`. Phase 4 pricing branches on this; populating now avoids a Phase-4 migration.
  - `same_day boolean NULL` — AR-DRG same-day flag.
  - `mechanical_ventilation_hours int NULL` — AR-DRG grouper input.
  - `separation_mode text NULL` — `home|transfer|against_medical_advice|deceased|...` (CHI MDS).
  - `cause_of_death text NULL` — ICD-10 code free-text in Phase 2.
  - `discharge_disposition text NULL`.
- Standard fields. `UNIQUE (tenant_id, encounter_number)`. Indexes `(tenant_id, beneficiary_id)`, `(tenant_id, status)`, `(tenant_id, journey_state)`, `(tenant_id, period_start DESC)`.
- **Note:** Phase 1's `beneficiary.journey_state` is registration-milestone only; ignore it for visit logic.

### `encounter_diagnosis`

`tenant_id`, `encounter_id fk→encounter ON DELETE CASCADE`, `code_system text NOT NULL DEFAULT 'icd-10-am'`, `code text NOT NULL`, `display text`, `role text NOT NULL DEFAULT 'admission'` (`admission|principal|secondary|discharge|external_cause`), `rank int NULL`, `present_on_admission text NULL` (`Y|N|U|W`), `is_chronic boolean DEFAULT false`, `onset_date date NULL`, `recorded_by uuid`, standard fields. Index `(tenant_id, encounter_id, role)`. Code values free-text in Phase 2; Phase 3 loads ICD-10-AM into `code_value`, Phase 10 enforces lookup.

### `encounter_care_team`

`tenant_id`, `encounter_id fk→encounter ON DELETE CASCADE`, `practitioner_user_id uuid NOT NULL` (validated via `tenant_members`), `role text NOT NULL` (`attending|consulting|admitting|referring|nurse|resident|...`), `is_primary boolean DEFAULT false`, `period_start timestamptz DEFAULT now()`, `period_end timestamptz NULL`, standard fields. `UNIQUE (encounter_id, practitioner_user_id, role)`.

### `vitals_observation`

`tenant_id`, `encounter_id fk→encounter ON DELETE CASCADE`, `beneficiary_id fk→beneficiary` (denormalized for fast patient timeline), `recorded_at timestamptz NOT NULL DEFAULT now()`, `recorded_by uuid`, `body_position text NULL`, `body_site text NULL`.

Measures (all nullable, units fixed): `temperature_c numeric(4,1)`, `heart_rate_bpm int`, `respiratory_rate_bpm int`, `systolic_mmhg int`, `diastolic_mmhg int`, `spo2_pct numeric(4,1)`, `pain_score int CHECK (pain_score BETWEEN 0 AND 10)`, `weight_kg numeric(5,2)`, `height_cm numeric(5,1)`, `bmi numeric(5,2) GENERATED ALWAYS AS (CASE WHEN height_cm > 0 AND weight_kg IS NOT NULL THEN round((weight_kg / ((height_cm/100.0)^2))::numeric, 2) ELSE NULL END) STORED`, `glucose_mmol_l numeric(5,2)`, `news2_score int NULL`, `notes text`, standard fields. Indexes `(tenant_id, beneficiary_id, recorded_at DESC)`, `(encounter_id, recorded_at DESC)`.

### `clinical_supporting_info` [NEW — restored from master doc]

CHI-mandated narrative MDS categories that the wide vitals table can't carry. At claim time (Phase 7) both `vitals_observation` AND `clinical_supporting_info` project into NPHIES `SupportingInfo`.

- `tenant_id`, `encounter_id fk→encounter ON DELETE CASCADE`, `beneficiary_id fk→beneficiary` (denormalized).
- `category text NOT NULL CHECK (category IN ('history_of_present_illness','physical_examination','treatment_plan','patient_history','investigation_result','chief_complaint','reason_for_visit','other'))`.
- `value_text text NULL`, `value_code text NULL`, `code_system text NULL`, `value_attachment_url text NULL` (Phase-3 storage placeholder), `recorded_at timestamptz NOT NULL DEFAULT now()`, `recorded_by uuid`, `sequence int NULL`, standard fields.
- Index `(tenant_id, encounter_id, category)`.

## 2. FHIR mapping layer (pure)

- `src/lib/mds/fhir/encounter.ts` — `encounterToFhirEncounter(row, careTeam, diagnoses, patientRef)` → FHIR R4 Encounter; `status` derives from the **clinical** `status` field (not `journey_state`); `class` from v3 ActCode; `subject`, `episodeOfCare`, `participant[]`, `diagnosis[]`, `period`, `reasonCode`.
- `src/lib/mds/fhir/encounter-status.ts` — maps internal `status` ↔ FHIR `Encounter.status` (`planned|arrived|triaged|in-progress|onleave|finished|cancelled`). Underscore→hyphen for `in_progress`/`on_leave`.
- `src/lib/mds/fhir/condition.ts` — `diagnosisToFhirCondition(row, patientRef, encounterRef)` with code system from `code_system` LOV, `clinicalStatus`, `onsetDateTime`, extension for `present_on_admission`.
- `src/lib/mds/fhir/observation.ts` — `vitalsToFhirBundle(row, patientRef, encounterRef)` → one Observation per non-null measure with LOINC codes (`8867-4` HR, `8480-6` SBP, `8462-4` DBP, `8310-5` Temp, `9279-1` RR, `59408-5` SpO2, `29463-7` Weight, `8302-2` Height, `39156-5` BMI, `38208-5` Pain, `15074-8` Glucose) and matching UCUM units.
- `src/lib/mds/fhir/supporting-info.ts` **[NEW]** — `supportingInfoToFhir(rows, patientRef, encounterRef)` → FHIR resources keyed by category (DocumentReference for narrative, Observation for investigation_result, etc.). Phase-7 claim builder consumes this alongside vitals.

URIs follow Phase-1 convention: hardcoded with `// VERIFY against NPHIES IG`; LOV load lands in Phase 3/10.

## 3. State machine — extend Phase 0 [REVISED]

`src/lib/mds/state-machine.ts` keeps the existing `JourneyState` machine for the MDS pipeline and **adds a second machine** for the clinical lifecycle:

```ts
export type EncounterClinicalStatus =
  'planned'|'arrived'|'triaged'|'in_progress'|'on_leave'|'finished'|'cancelled';

export const ENCOUNTER_CLINICAL_TRANSITIONS: Record<EncounterClinicalStatus, EncounterClinicalStatus[]> = {
  planned:     ['arrived','cancelled'],
  arrived:     ['triaged','in_progress','cancelled'],
  triaged:     ['in_progress','cancelled'],
  in_progress: ['on_leave','finished'],
  on_leave:    ['in_progress','finished'],
  finished:    [],
  cancelled:   [],
};

export function canTransitionEncounter(from, to): boolean
export function assertEncounterTransition(from, to): void   // throws 409-shaped error
```

Phase-0 `canTransition(JourneyState, ...)` is left unchanged (still permissive for the MDS pipeline). The two machines coexist; Phase 2 only drives the clinical one.

## 4. Zod schemas

`src/lib/mds/schema/encounter.ts`:

- `EpisodeOfCareCreate/Update`.
- `EncounterCreate` — required `beneficiary_id, class`; optional `episode_of_care_id, coverage_id, type, service_type, priority, period_start, reason_text, chief_complaint`. `status` defaults `'planned'`, `journey_state` defaults `'encounter_open'`, both set server-side. Restored columns (`same_day`, `mechanical_ventilation_hours`, etc.) are also accepted optionally on create for parity with Phase 5.
- `EncounterUpdate` — partial of patch-safe fields; **excludes both `status` and `journey_state**` (clinical status via `advance`; MDS journey via later phase routes).
- `EncounterAdvance` — `{ to: EncounterClinicalStatus, reason?: string, period_end?: string }`.
- `DiagnosisCreate/Update`.
- `CareTeamMemberCreate/Update`.
- `VitalsCreate` — all measures optional with `.refine` requiring at least one non-null measure; `recorded_at?` defaults now.
- `SupportingInfoCreate/Update` **[NEW]** — `category` (enum), at least one of `value_text|value_code|value_attachment_url`; `sequence?`.

Permissive in Phase 2; Phase 10 tightens.

## 5. Routes (all under `src/routes/api/clinical/v1/`)

`createFileRoute` + `server.handlers`, `preflight()`, `requireTenant` reads, `requireClinicalRole(...)` writes, audit + standard envelope. **Every URL-param write performs the tenant-ownership guard** (load parent row, assert `tenant_id === ctx.tenantId`, 404 otherwise).

- `episodes.ts` — list (filter `beneficiary_id`, `status`) / create (`registrar|case_manager`).
- `episodes.$id.ts` — get / patch (`case_manager|physician`).
- `encounters.ts` — list (filters `beneficiary_id`, `status`, `journey_state`, `class`, `from`, `to`) / create (`registrar|nurse|physician`). Auto-generates `encounter_number`. Trigger derives `reimbursement_model` from `class`.
- `encounters.$id.ts` — get (with care team + diagnosis count) / patch non-state fields (`registrar|nurse|physician|case_manager`).
- `encounters.$id.advance.ts` — `POST { to, reason?, period_end? }`. Validates via `assertEncounterTransition`, writes **clinical `status**` (NOT `journey_state`), stamps `period_end` when finishing/cancelling, audits `encounter.advance` with `from`/`to` (`nurse|physician|case_manager`). 409 on illegal transition.
- `encounters.$id.diagnoses.ts` — list / add (`physician|coder`).
- `diagnoses.$id.ts` — patch / delete (`physician|coder`).
- `encounters.$id.care-team.ts` — list / add (`physician|case_manager|tenant_admin`); enforces `practitioner_user_id ∈ tenant_members` for this tenant (404 otherwise).
- `care-team.$id.ts` — patch / delete.
- `encounters.$id.vitals.ts` — list timeline / create (`nurse|physician`). Backfills `beneficiary_id` from parent encounter.
- `vitals.$id.ts` — get / patch (`nurse|physician`).
- `encounters.$id.supporting-info.ts` **[NEW]** — list / add (`physician|nurse|coder`). Backfills `beneficiary_id`.
- `supporting-info.$id.ts` **[NEW]** — patch / delete (`physician|nurse|coder`).
- `encounters.$id.fhir.ts` — `GET → { encounter, conditions:[], observations:[], supportingInfo:[] }` assembled via mappers, including referenced patient.

## 6. OpenAPI

Extend `src/lib/openapi-clinical-spec.ts`: tags `Episodes`, `Encounters`, `Diagnoses`, `CareTeam`, `Vitals`, `SupportingInfo`; schemas for each create/update plus `EncounterAdvance`, `FhirEncounter`, `FhirCondition`, `FhirObservation`, `FhirSupportingInfo`; full path entries for all ~14 routes with params, bodies, 200/201/400/401/403/404/409/422 responses. Tag-grouped under "Clinical" in `/superadmin/api-docs`.

## 7. Verification

- `bun run build` green; `tsgo` clean; existing Playwright suites pass.
- Swagger smoke (`/superadmin/api-docs` → Clinical):
  1. Episode → encounter → `advance` `planned→arrived→triaged→in_progress` (200 each) → illegal `in_progress→planned` (409) → `in_progress→finished` (200, `period_end` stamped). **Verify `journey_state` is unchanged throughout** (stays `encounter_open`) — proves the two axes are independent.
  2. Create IMP-class encounter → row has `reimbursement_model = 'drg_bundled'`; AMB encounter → `'itemized_sbs'`.
  3. Add 2 diagnoses (principal + secondary) → list ordered by `rank`.
  4. Add care-team member with foreign-tenant user → 404.
  5. Vitals: post reading with height+weight → BMI auto-computed; `/vitals/$id` returns row; patient-scoped timeline query returns without joining encounter.
  6. Supporting info: post `category='history_of_present_illness'` with `value_text` → appears in `/encounters/$id/fhir` under `supportingInfo[]`.
  7. `/encounters/$id/fhir` → Encounter.status is `in-progress` (mapped from clinical `status`), Condition[]/Observation[] carry correct LOINC + UCUM.
  8. Tenant B cannot read tenant A's encounter (404).
- `psql`: RLS enabled on all six tables; grants for `authenticated` + `service_role`; `encounter_number` unique within tenant; BMI generated column populated; `reimbursement_model` trigger fires.
- **API coverage:** `episode_of_care` → episodes(.$id); `encounter` → encounters(.$id, .$id.advance, .$id.fhir); `encounter_diagnosis` → encounters.$id.diagnoses + diagnoses.$id; `encounter_care_team` → encounters.$id.care-team + care-team.$id; `vitals_observation` → encounters.$id.vitals + vitals.$id; `clinical_supporting_info` → encounters.$id.supporting-info + supporting-info.$id. No orphan tables.

## Files touched

```
supabase migration (6 tables + RLS + grants + triggers;
                    encounter_number gen helper; BMI generated column;
                    reimbursement_model derivation trigger; uses Phase-1 is_tenant_member)
src/lib/mds/fhir/encounter.ts                                 (new)
src/lib/mds/fhir/encounter-status.ts                          (new)
src/lib/mds/fhir/condition.ts                                 (new)
src/lib/mds/fhir/observation.ts                               (new)
src/lib/mds/fhir/supporting-info.ts                           (new)
src/lib/mds/schema/encounter.ts                               (new)
src/lib/mds/state-machine.ts                                  (extend: EncounterClinicalStatus machine — keeps existing JourneyState untouched)
src/routes/api/clinical/v1/_helpers.ts                        (extend: shared tenant-ownership helper)
src/routes/api/clinical/v1/episodes.ts                        (new)
src/routes/api/clinical/v1/episodes.$id.ts                    (new)
src/routes/api/clinical/v1/encounters.ts                      (new)
src/routes/api/clinical/v1/encounters.$id.ts                  (new)
src/routes/api/clinical/v1/encounters.$id.advance.ts          (new)
src/routes/api/clinical/v1/encounters.$id.diagnoses.ts        (new)
src/routes/api/clinical/v1/diagnoses.$id.ts                   (new)
src/routes/api/clinical/v1/encounters.$id.care-team.ts        (new)
src/routes/api/clinical/v1/care-team.$id.ts                   (new)
src/routes/api/clinical/v1/encounters.$id.vitals.ts           (new)
src/routes/api/clinical/v1/vitals.$id.ts                      (new)
src/routes/api/clinical/v1/encounters.$id.supporting-info.ts  (new)
src/routes/api/clinical/v1/supporting-info.$id.ts             (new)
src/routes/api/clinical/v1/encounters.$id.fhir.ts             (new)
src/lib/openapi-clinical-spec.ts                              (extend: 6 tags + schemas + paths)
```

four targeted edits worth handing back before you ship the migration:

**1. Kill the chief-complaint / reason-for-visit duplication.** The `clinical_supporting_info` category enum includes `chief_complaint` and `reason_for_visit`, but both already have canonical homes on the encounter (`chief_complaint`, `reason_text`). Two columns plus an enum value for the same fact is a drift trap. Drop `chief_complaint` and `reason_for_visit` from the supporting-info enum; keep it for the genuinely narrative categories that have no encounter column (`history_of_present_illness`, `physical_examination`, `treatment_plan`, `patient_history`, `investigation_result`, `other`). The Phase 7 claim mapper will synthesize the NPHIES `chief-complaint` and `reason-for-visit` SupportingInfo entries from the encounter columns.

**2. Don't freeze** `journey_state` **until Phase 5 — advance it to** `clinically_documented` **here.** Lovable's note defers all MDS-pipeline transitions to Phase 5+, which skips the `clinically_documented` milestone that this phase actually owns (documentation happens now). Add a permissive side-effect: after a diagnosis or supporting-info write, if a `principal` diagnosis and a `chief_complaint` both exist, advance `encounter_open → clinically_documented`. The two axes are still independent — they advance on *different triggers* (clinical status via `advance`, journey via documentation milestone), which is the real proof of independence, not a frozen field. Update verification check #1 accordingly: `status` moves planned→finished while `journey_state` moves encounter_open→clinically_documented, on separate triggers.

**3. Map internal underscore enums to canonical NPHIES hyphenated codes in the mappers.** The DB enum is `history_of_present_illness`; NPHIES SupportingInfo expects `history-of-present-illness`. You already do this underscore→hyphen translation for `encounter-status`; apply the same single mapping table in `supporting-info.ts` (and reuse it in the Phase 7 claim builder) so the categories serialize NPHIES-valid. Don't let the raw DB enum leak into a FHIR/claim payload.

**4. Make** `reimbursement_model` **effectively non-null.** It's `text NULL` with a derivation trigger — fine, but Phase 4 branches on it unconditionally. Make the trigger `BEFORE INSERT OR UPDATE OF class` so it always populates, and either add a `CHECK (reimbursement_model IN ('drg_bundled','itemized_sbs'))` or set the column `NOT NULL` once the trigger guarantees it. That way a stray insert can never leave Phase 4 with a null branch key.

One optional add if you want NPHIES `CareTeam` fully faithful: `speciality` (and `qualification`) on `encounter_care_team` — it's a CareTeam field and also feeds DRG specialty. Low priority; safe to defer to Phase 5 where admission/discharge specialty already lands.

Everything else — the rich diagnosis model with POA, the BMI generated column, the tenant guards, the ~14 routes, the API-coverage block — ship as written.