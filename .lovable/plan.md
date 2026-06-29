# Phase 1 — Registration MDS (Beneficiary + Coverage) — REVISED

Journey entry point for the clinical vertical: NPHIES `Beneficiary`, `Coverage`, `CoverageClass` as tenant-scoped tables, FHIR mappers, Zod schemas. Permissive validation; strict MDS waits for Phase 10.

> Lovable's draft was faithful and repo-aligned (`touch_updated_at()` exists; `is_tenant_member` mirrors the existing `has_role`/`is_portal_staff` pattern; GRANT→RLS→POLICY matches `tenant_members`). Changes below are tagged **[AMENDED]** / **[NEW]**; everything untagged is kept as Lovable proposed.

## Standing rule (applies to this and every later phase) [NEW]

**API-first, fully wired.** No orphan tables and no orphan endpoints:

- Every new table is reachable through the API — either its own CRUD routes or a parent's nested routes (e.g. `coverage_class` via the coverage endpoints).
- Every route reads/writes a real table; no stubbed handlers returning static data.
- Each phase's verification lists an **API coverage** line mapping every new table → the route(s) that read and write it.

## 1. Supabase migration

Three tables, tenant-scoped, RLS on, GRANT → ENABLE RLS → POLICY, plus:

- `is_tenant_member(_user_id uuid, _tenant uuid) → boolean` — `SECURITY DEFINER`, `SET search_path = public`, reads `tenant_members`. (Confirmed: no such helper exists yet; this matches the repo's `has_role`/`is_portal_staff` convention.)
- `beneficiary`
  - `tenant_id`, `patient_file_no`, `first_name`, `middle_name`, `last_name`, `full_name NOT NULL`, `dob date NOT NULL`, `gender text NOT NULL`, `nationality`, `document_type text NOT NULL`, `document_id text NOT NULL`, `contact_number`, `ehealth_id`, `residency_type`, `marital_status`, `blood_group`, `preferred_language`, `email`, `address_line`, `address_street`, `address_city`, `address_district`, `address_state`, `address_postal_code`, `address_country`, `occupation`, `religion`, `birth_weight_grams int NULL` **[AMENDED — restored from master doc; neonate AR-DRG grouper input (Phase 6)]**, `patient_user_id uuid NULL` **[AMENDED — restored; links the beneficiary to an auth user for the patient app identity model (Phase 8)]**, `journey_state text NOT NULL DEFAULT 'registered'`, `created_by`, `updated_by`, standard `id/created_at/updated_at`.
  - `UNIQUE (tenant_id, document_type, document_id)`.
  - Indexes on `(tenant_id, full_name)`, `(tenant_id, patient_file_no)`, `(patient_user_id)` **partial WHERE patient_user_id IS NOT NULL** **[NEW — patient-app lookup]**.
  - **Note [NEW]:** `journey_state` here is only the *registration milestone*. The authoritative per-visit journey state lives on `encounter`/`episode_of_care` (Phase 2); do not drive later logic off `beneficiary.journey_state`.
- `coverage`
  - `tenant_id`, `beneficiary_id fk→beneficiary ON DELETE CASCADE`, `coverage_type text NOT NULL`, `member_id text NOT NULL`, `policy_number`, `expiry_date date`, `payer_nphies_id text NOT NULL`, `tpa_nphies_id`, `relation_with_subscriber text NOT NULL`, `policy_holder text NOT NULL`, `status text NOT NULL DEFAULT 'active'`, **nullable Phase-3 FK placeholders (UUID, no FK target yet):** `payer_id`**,** `policy_id`**,** `insurance_plan_id`**,** `network_id` **[AMENDED — renamed** `plan_id`**→**`insurance_plan_id` **to match the Phase-3** `insurance_plan` **table, and restored** `network_id` **(the pricing resolver walks coverage→plan AND network in Phase 4)]**, standard fields.
- `coverage_class`
  - `tenant_id`, `coverage_id fk→coverage ON DELETE CASCADE`, `type text NOT NULL CHECK (type IN ('group','plan'))`, `value text NOT NULL`, `display_name`, standard fields.
- **RLS** on each (SELECT/INSERT/UPDATE/DELETE to `authenticated` gated by `is_tenant_member(auth.uid(), tenant_id)`; `service_role` full bypass).
- `updated_at` **trigger** reuses existing `public.touch_updated_at()`. (Confirmed present.)

## 2. FHIR mapping layer (pure, no DB)

- `src/lib/mds/fhir/patient.ts` — `beneficiaryToFhirPatient(row)` → FHIR R4 Patient, KSA identifier from `document_type`, name.text + given/family, gender, birthDate, telecom, address, extensions for nationality/occupation/religion.
- `src/lib/mds/fhir/coverage.ts` — `coverageToFhirCoverage(coverage, classes, patientRef)` → FHIR Coverage (payor identifier = NPHIES payer id, subscriberId = member_id, relationship, period.end = expiry_date, class[] from `coverage_class`).
- `src/lib/mds/fhir/identifier-systems.ts` — document_type/relation/coverage_type LOV → NPHIES URIs.
  - **[AMENDED] Verify the canonical NPHIES identifier system URIs against the current NPHIES IG before shipping** (e.g. national id vs iqama vs passport). The values must match NPHIES exactly or the payer will reject the bundle. Source these from `code_system`/`code_value` where possible rather than hardcoding.

## 3. Zod schemas

`src/lib/mds/schema/registration.ts`: `BeneficiaryCreate`, `BeneficiaryUpdate` (partial), `CoverageCreate` (optional `classes: CoverageClassCreate[]`), `CoverageClassCreate`, `CoverageUpdate` **(partial — status/expiry/policy linkage)** **[NEW — backs the coverage PATCH]**. Required: `full_name, dob, gender, document_type, document_id`; coverage `member_id, payer_nphies_id, coverage_type, relation_with_subscriber, policy_holder`. Rest optional. Phase 10 tightens.

## 4. Routes (all under `src/routes/api/clinical/v1/`)

`createFileRoute` + `server.handlers`, `preflight()` CORS, `requireTenant` for reads, `requireClinicalRole(request, ['registrar'])` for writes (`tenant_admin` implicit), every write audits + returns the standard envelope.

- `beneficiaries.ts` — `GET` paginated (filters `q`, `document_id`, `limit`, `offset`); `POST` create (sets `journey_state='registered'`, `tenant_id` from context).
- `beneficiaries.$id.ts` — `GET` one (tenant-scoped); `PATCH` update.
- `beneficiaries.$id.coverage.ts` — `GET` coverages + classes; `POST` create coverage with nested `classes[]` in one transaction.
  - **[AMENDED — security] Because this handler uses the service client (RLS bypassed), it MUST first load the** `$id` **beneficiary and assert** `beneficiary.tenant_id === auth.tenantId` **before inserting; return 404 otherwise. Apply this ownership check to every service-client write that takes an id from the URL.**
- `coverage.$id.ts` **[NEW] —** `GET` **one;** `PATCH` **update (status, expiry_date, policy linkage); same tenant-ownership guard. Makes coverage fully API-managed, not write-once.**
- `beneficiaries.$id.fhir.ts` — `GET` → `{ patient, coverages: [{ coverage, classes }] }` via mappers.

## 5. OpenAPI

Extend `src/lib/openapi-clinical-spec.ts`: tags `Registration`, `Coverage`, `FHIR`; schemas `Beneficiary`, `BeneficiaryCreate`, `Coverage`, `CoverageCreate`, `CoverageUpdate`, `CoverageClass`, `FhirPatient`, `FhirCoverage`; path entries for the **five** routes (incl. the new `coverage.$id`) with params, bodies, and 200/201/400/401/403/404/409 responses.

## 6. Verification

- `bun run build` green; existing Playwright suites pass.
- Swagger smoke (`/superadmin/api-docs` → Clinical): create beneficiary in tenant A; tenant-B member cannot read it (404); duplicate `(document_type, document_id)` → 409; `beneficiaries/:id/fhir` returns Patient with `identifier[0].system` matching document type; PATCH a coverage's status; **attempt to POST coverage onto another tenant's beneficiary id → 404 (ownership guard holds)** **[NEW]**.
- `psql`: RLS enabled on all three tables; grants for `authenticated` + `service_role`.
- **API coverage [NEW]:** `beneficiary` → beneficiaries(.$id); `coverage` → beneficiaries.$id.coverage + coverage.$id; `coverage_class` → beneficiaries.$id.coverage (nested). No orphan tables.

## Files touched

```
supabase migration (3 tables + is_tenant_member + RLS + grants + triggers;
                    beneficiary +birth_weight_grams +patient_user_id;
                    coverage +network_id, plan_id→insurance_plan_id)
src/lib/mds/fhir/identifier-systems.ts                (new; verify NPHIES URIs)
src/lib/mds/fhir/patient.ts                           (new)
src/lib/mds/fhir/coverage.ts                          (new)
src/lib/mds/schema/registration.ts                    (new; +CoverageUpdate)
src/routes/api/clinical/v1/beneficiaries.ts           (new)
src/routes/api/clinical/v1/beneficiaries.$id.ts       (new)
src/routes/api/clinical/v1/beneficiaries.$id.coverage.ts  (new; +tenant-ownership guard)
src/routes/api/clinical/v1/coverage.$id.ts            (new)
src/routes/api/clinical/v1/beneficiaries.$id.fhir.ts  (new)
src/lib/openapi-clinical-spec.ts                      (extend: tags + schemas + paths)

```

Out of scope (per master prompt): payer/policy/plan/network masters and DRG tables (Phase 3), encounters/episodes/diagnoses (Phase 2), strict MDS enforcement (Phase 10), real LOV loading into `code_value` (Phase 3/10). The nullable `payer_id/policy_id/insurance_plan_id/network_id` on `coverage` are placeholders FK-bound when masters land.

Approve and Lovable ships the migration first for review, then the code batch.