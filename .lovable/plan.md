# Phase 5 — Admission MDS & Discharge MDS — REVISED

NPHIES `EncounterHospitalization` + emergency disposition capture, populating the grouper-input fields (LOS, separation mode, ventilation hours) Phase 6 reads. Standing rule: **API-first, fully wired — no orphan tables.**

> Lovable's draft was clean but lost track of columns the corrected Phase 2 already added. Changes tagged **[AMENDED]** / **[NEW]**; untagged content kept as proposed.

## Scope (additive only)

- No changes to existing Phase 0–4 tables beyond the two reconciliations noted below.
- Two new tables, 3 endpoints, 2 FHIR mappers, OpenAPI updates, monotonic journey advances.

## Database (one migration)

Both new tables tenant-scoped, RLS + GRANTs (authenticated CRUD, service_role all, no anon), `touch_updated_at`.

**1.** `encounter_hospitalization` — 1:1 with `encounter`

- `tenant_id`, `encounter_id` UNIQUE FK
- `admission_specialty`, `admission_source`, `origin`, `intended_length_of_stay`, `re_admission` (text LOVs, validated in Zod)
- `discharge_specialty`, `discharge_disposition` **[AMENDED — canonical home; see reconciliation below]**
- `admitted_at`, `discharged_at timestamptz`
- `length_of_stay_days int GENERATED ALWAYS AS (CASE WHEN discharged_at IS NOT NULL AND admitted_at IS NOT NULL THEN GREATEST(0, (discharged_at::date - admitted_at::date)) END) STORED` **[NEW — LOS for DRG trim-point math in Phase 7]**
- `created_by/updated_by`, timestamps + trigger

**2.** `encounter_emergency` — 1:1 with `encounter` where `class='EMER'`

- `tenant_id`, `encounter_id` UNIQUE FK
- `triage_date`, `triage_category`, `emergency_arrival_code`, `emergency_service_start`, `emergency_department_disposition`
- audit cols + trigger

**3. Column reconciliation with Phase 2 (NOT re-adds)** **[AMENDED — was Lovable's step 3, which duplicated columns]**

- `encounter.separation_mode`, `encounter.mechanical_ventilation_hours`, `encounter.same_day`, `encounter.cause_of_death` **already exist** (added in the corrected Phase 2). Phase 5 only **populates** them at discharge — do **not** ALTER TABLE ADD them again.
- `encounter.discharge_disposition` was also added in Phase 2 but is **double-homed** with `encounter_hospitalization.discharge_disposition`. Consolidate on the hospitalization table (it groups all discharge MDS fields) and **drop it from** `encounter` (`ALTER TABLE encounter DROP COLUMN discharge_disposition`). Single source of truth.

**4. Triggers — monotonic journey advance** **[AMENDED]**

- Define a milestone rank (`encounter_open<clinically_documented<investigations_ordered<admitted< discharged<coded<grouped<claim_ready<submitted`). Triggers only advance to a **higher** rank, never regress.
- On `encounter_hospitalization` insert/update with `admitted_at` set → advance `encounter.journey_state` to `admitted` from any state ≥ `encounter_open`. (For IP, admission precedes ordering; a later order must not knock the state back to `investigations_ordered` — the rank guard prevents regression.)
- On `discharged_at` set + `separation_mode` present → advance to `discharged`.

## Zod schemas (`src/lib/mds/schema/hospitalization.ts`)

- `HospitalizationUpsert`, `EmergencyUpsert`.
- `DischargePayload { discharged_at, separation_mode, mechanical_ventilation_hours?, cause_of_death?, discharge_specialty?, discharge_disposition? }` **[AMENDED — +cause_of_death, +discharge fields]**. `cause_of_death` required when `separation_mode='deceased'` (Zod refine, permissive otherwise). `same_day` is derived server-side, not client-supplied.
- LOV enums permissive (string + length cap) per the Phase 10 strictness rule.

## FHIR mappers (`src/lib/mds/fhir/hospitalization.ts`)

- `toFhirHospitalization(row)` → `Encounter.hospitalization` (admitSource, dischargeDisposition, origin coding via `identifier-systems`; `// VERIFY against NPHIES IG`).
- `toFhirEmergency(row)` → Encounter extensions (triage category, ED disposition) per NPHIES profile.
- Update `encounter.ts` to splice these into the Encounter resource when present.

## API routes (`src/routes/api/clinical/v1/`)

GET via `requireTenant`; writes `requireClinicalRole(['physician','nurse','tenant_admin'])`; `clinicalAudit` on writes; tenant-ownership guard.

- `encounters.$id.admit.ts` — POST upsert hospitalization (admission fields + `admitted_at`); advances journey to `admitted`. **Rejects 409 if** `encounter.class NOT IN ('IMP','HH')` **[NEW — mirrors the emergency guard;** `drg_bundled` **is IMP-only]**. GET returns current row.
- `encounters.$id.discharge.ts` — POST sets `discharged_at`, `separation_mode`, `mechanical_ventilation_hours`, `cause_of_death` on `encounter`, **derives** `same_day`, and writes discharge fields on hospitalization; advances journey to `discharged`. Idempotent. **[AMENDED]**
- `encounters.$id.emergency.ts` — GET/POST upsert `encounter_emergency` (409 if `class != 'EMER'`).
- Extend `encounters.$id.fhir.ts` to embed the `hospitalization` block when the row exists.

## OpenAPI

Extend `src/lib/openapi-clinical-spec.ts`: tag **Hospitalization**, schemas for both tables + discharge payload, 3 new paths (+ FHIR example with hospitalization block).

## Acceptance

- Admit then discharge an IP encounter → FHIR Encounter shows `hospitalization`; `length_of_stay_days` computed.
- Admit a non-IMP/HH encounter → 409. **[NEW]**
- `separation_mode`, `mechanical_ventilation_hours`, `same_day` (derived), `cause_of_death` (when deceased) captured on `encounter` for the Phase 6 grouper — and the migration adds **no** duplicate columns (Phase 2 owns them). **[AMENDED]**
- `discharge_disposition` exists only on `encounter_hospitalization` (dropped from `encounter`). **[NEW]**
- ER encounter records triage + ED disposition; non-EMER → 409.
- Journey: `admitted` on admit (from any ≥ encounter_open, never regressing), `discharged` on discharge.
- Typecheck + route generation clean.
- **API coverage:** `encounter_hospitalization` → admit/discharge; `encounter_emergency` → emergency. No orphan tables.

## Delivery & Documentation milestone (standing DoD — see Phase 4 §8)

Phase 5 isn't done until both living docs are updated:

- `docs/his-technical-manual.md` — add the Admission/Discharge data model (the two tables, the generated `length_of_stay_days`, the Phase-2 column reconciliation, the monotonic journey-rank rule), the admit/discharge/emergency API reference, and the FHIR `Encounter.hospitalization` mapping. Note the grouper-input contract (which encounter columns Phase 6 reads).
- `docs/his-user-manual.md` — role task guides: physician/nurse "Admit a patient", "Record ER triage + disposition", "Discharge a patient (incl. deceased + cause of death)"; what each field means and which are mandatory for an inpatient claim (forward-ref to Phase 10).
- `docs/changelog.md` — Phase 5 entry referencing the migration + routes.

## Files touched

```
supabase migration (2 tables + generated LOS col; populate-not-readd encounter cols;
                    drop encounter.discharge_disposition; monotonic journey triggers)
src/lib/mds/schema/hospitalization.ts                         (new)
src/lib/mds/fhir/hospitalization.ts                           (new)
src/lib/mds/fhir/encounter.ts                                 (extend: splice hospitalization/emergency)
src/lib/mds/state-machine.ts                                  (extend: milestone rank + monotonic advance)
src/routes/api/clinical/v1/encounters.$id.admit.ts            (new; class guard)
src/routes/api/clinical/v1/encounters.$id.discharge.ts        (new; +cause_of_death, derive same_day)
src/routes/api/clinical/v1/encounters.$id.emergency.ts        (new)
src/routes/api/clinical/v1/encounters.$id.fhir.ts             (extend: hospitalization block)
src/lib/openapi-clinical-spec.ts                              (extend: tag + schemas + paths)
docs/his-technical-manual.md | docs/his-user-manual.md | docs/changelog.md   (update)

```

Out of scope (later): DRG grouping (Phase 6 reads the grouper inputs set here), claim assembly (Phase 7), strict NPHIES/DRG validation (Phase 10).

&nbsp;