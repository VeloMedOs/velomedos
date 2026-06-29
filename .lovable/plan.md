# Phase 0 — Mini-HIS / NPHIES MDS Foundations (REVISED)

Guardrails only — no clinical business tables, no patient data. Revised to carry the KSA code-system reality (ICD-10-AM, ACHI, AR-DRG v9, SBS v3, LOINC, GTIN/MRID) and the inpatient-DRG vs outpatient-itemized split that the later phases depend on.

Existing app untouched. New `/api/clinical/v1/*` namespace alongside `/api/admin/v1/*` and `/api/public/v1/*`.

> Changes from the first Phase 0 draft are tagged **[AMENDED]** or **[NEW]**. Everything untagged is unchanged from the version Lovable already proposed.

---

## What gets built

### 1. Security hygiene (unchanged)

- Add `.env` to `.gitignore` (currently tracked).
- Sweep client code for any `SUPABASE_SERVICE_ROLE_KEY` reference — fail loud if found.

### 2. Supabase migration — clinical foundations

- **enum** `clinical_role` **[AMENDED]** — `registrar, physician, nurse, lab_tech, radiologist, pharmacist, coder, case_manager, cashier, tenant_admin, read_only`. (`coder` and `case_manager` added — clinical coding and utilization/DRG review are distinct accountable roles; AR-DRG output quality depends on the coder.)
- `tenant_members.clinical_role` — nullable column added.
- `code_system` **[AMENDED — versioning is now first-class]** `id, key text unique, name, kind, source_authority, oid nullable, version, edition, is_current boolean default true, effective_from date, effective_to date, created_at, updated_at`.
  - `kind` enum: `diagnosis | procedure | billing | drg | drug | lab | coding_standard | lov`.
  - Rationale: CHI re-versions these (ICD-10-AM 10th, AR-DRG v9.0, SBS v3). Code values and prices are pinned to a `code_system` row, so a version bump is additive (insert a new `code_system` row + its `code_value`s, flip `is_current`) and never rewrites history. The DRG implementation guidance treats version control as a core requirement.
- `code_value` — `id, code_system_id fk, code, display, parent_code, active, attributes jsonb` **[AMENDED: +attributes jsonb]**.
  - `parent_code` supports hierarchical systems (AR-DRG: MDC → ADRG → DRG; ICD chapters).
  - `attributes jsonb` holds system-specific fields without schema churn (e.g. a DRG row's `relative_weight`, `mdc`, `adrg`, `partition`; a drug row's `atc`, `strength`).
- `clinical_audit` — `id, tenant_id, actor_id, action, target, target_id, payload jsonb, created_at`. (unchanged)

RLS on all four:

- `code_system` / `code_value` — read to `authenticated`, write to `service_role` only.
- `clinical_audit` — readable to tenant members (via `tenant_members`), insert via service role only.
- Grants per the public-schema-grant rule on every new table.

**Seed** `code_system` **[AMENDED — real KSA-adopted systems with versions]**:


| key        | name                                 | kind            | source       | version |
| ---------- | ------------------------------------ | --------------- | ------------ | ------- |
| icd-10-am  | ICD-10-AM (diagnoses)                | diagnosis       | IHACPA / CHI | 10th    |
| achi       | ACHI (interventions/procedures)      | procedure       | IHACPA / CHI | 10th    |
| acs        | Australian Coding Standards          | coding_standard | IHACPA / CHI | 10th    |
| ar-drg     | AR-DRG (MDC / ADRG / DRG)            | drg             | IHACPA / CHI | 9.0     |
| sbs        | Saudi Billing System (non-admitted)  | billing         | CHI          | 3       |
| loinc      | LOINC (lab observations)             | lab             | Regenstrief  | current |
| gtin       | GTIN (drug trade item / barcode)     | drug            | GS1          | -       |
| mrid       | SFDA Medication Registration ID      | drug            | SFDA         | -       |
| sfda-sci   | SFDA scientific/drug register code   | drug            | SFDA         | -       |
| nphies-lov | NPHIES LOV / ValueSets (placeholder) | lov             | NPHIES       | -       |


`code_value` left empty (loaded Phase 3/9 from CHI-provided files). **Note for the team:** ICD-10-AM, ACHI, ACS and AR-DRG are licensed classifications; store only the KSA-adopted code values loaded from CHI-provided files — do not redistribute the source classification, and do not generate codes.

### 3. Clinical auth helper — `src/lib/api-clinical.ts` (unchanged)

- `requireTenant(request)` → resolves bearer → user → `tenant_members` → `{ ok, userId, tenantId, role, clinicalRole }` or 401/403 envelope.
- `requireClinicalRole(request, roles: ClinicalRole[])` → builds on `requireTenant`.
- `clinicalAudit(actorId, tenantId, action, target, targetId, payload)` → best-effort.
- Re-exports `json`, `preflight`, `serviceClient`.
- Error envelope: `{ error, code, request_id: crypto.randomUUID() }`.

### 4. Journey state machine skeleton — `src/lib/mds/state-machine.ts` **[AMENDED]**

Pure module, no DB. Two amendments anticipate the IP/DRG path without overbuilding:

- Type `JourneyState = 'registered' | 'encounter_open' | 'clinically_documented' | 'investigations_ordered' | 'admitted' | 'discharged' | 'coded' | 'grouped' | 'claim_ready' | 'submitted' | 'void'`.
  - **[NEW]** `coded` (clinical coding complete) and `grouped` (AR-DRG assigned) sit between `discharged` and `claim_ready` — they apply to **inpatient** journeys only. Outpatient journeys skip straight from documented/discharged to `claim_ready`.
- `TRANSITIONS: Record<JourneyState, JourneyState[]>`.
- `canTransition(from, to, role)` — permissive in Phase 0 (logs a reason if it would block, but always allows). Strict gates land in Phase 9.
- **[NEW]** Export a `reimbursementModel(encounterClass)` helper stub returning `'drg_bundled'` for inpatient (`IMP`) and `'itemized_sbs'` otherwise. Permissive/no-op now; Phase 4 pricing and Phase 6 claim assembly branch on it.

### 5. Clinical OpenAPI surface (unchanged structure)

- `src/lib/openapi-clinical-spec.ts` — OpenAPI 3.1.0, `servers: [{ url: '/api/clinical/v1' }]`, bearer security scheme, empty `paths`. **[AMENDED]** `info.title = "VeloMed OS Clinical API"`, and the description notes two claim shapes will be hosted: itemized (SBS) and DRG-bundled.
- `src/routes/api/clinical/v1/openapi.ts` — `createFileRoute` server handler returning JSON.
- Update `src/routes/_authenticated/superadmin.api-docs.tsx` — add a third toggle **Clinical** next to Admin/Public, pointing at `/api/clinical/v1/openapi`. Existing toggles untouched.

### 6. Verification (unchanged + one addition)

- TypeScript builds.
- Existing `route-redirects` and `responsive-overflow` Playwright suites still pass.
- New smoke check: `/api/clinical/v1/openapi` returns valid JSON with `info.title = "VeloMed OS Clinical API"`.
- Superadmin api-docs page renders all three spec toggles.
- **[NEW]** `code_system` seed query returns the 10 systems above with `is_current = true` and correct `version`/`edition` for icd-10-am (10th), achi (10th), ar-drg (9.0), sbs (3).

---

## Out of scope for Phase 0 (amended)

- Any clinical business tables (beneficiary, coverage, encounter, orders, claims) — Phase 1+.
- Loading actual `code_value` rows (ICD-10-AM, ACHI, SBS, AR-DRG weights, drug lists) — Phase 3/9.
- **[NEW]** AR-DRG grouper integration — its own phase (see "Downstream" below). **Do NOT build or reimplement a grouper**; it is licensed CHI-approved external software, integrated like the NPHIES gateway (feed MDS → receive DRG).
- **[NEW]** PROMs/PREMs (VBHC outcomes) capture — later phase; CHI is standardizing these as an NPHIES MDS (PROMIS-10 favored over EQ-5D in the CHI pilot).
- UI surfaces in patient/provider/business portals — Phase 7.
- Strict MDS enforcement — Phase 9.
- Real NPHIES gateway calls — Phase 8.

## Files created / touched

```
.gitignore                                          (append .env)
supabase migration                                  (enum, 4 tables w/ versioned code_system, RLS, grants, seeds)
src/lib/api-clinical.ts                             (new)
src/lib/mds/state-machine.ts                        (new — +coded/grouped states, reimbursementModel stub)
src/lib/openapi-clinical-spec.ts                    (new)
src/routes/api/clinical/v1/openapi.ts               (new)
src/routes/_authenticated/superadmin.api-docs.tsx   (add Clinical toggle)

```

---

## Downstream phase impacts from the SBS/DRG uploads (not built in Phase 0, but plan for them)

- **Phase 3 (masters):** Service Master uses a `service_code` child table mapping each service to many `{code_system, code}` pairs (SBS billing + ACHI clinical + LOINC, etc.), not fixed columns. Drug Master carries `gtin` + `mrid` (+ optional SFDA sci code). Add AR-DRG reference data via `code_value` (DRG rows with `relative_weight`, `mdc`, `adrg` in `attributes`) and a `drg_base_rate` table per payer/contract.
- **Phase 4 (pricing):** branch on `reimbursementModel`. Outpatient → itemized SBS pricing (existing design). Inpatient → charges captured for internal costing, but the payer price = DRG base-rate × relative weight ± outlier/ICU adjustments. Lab/imaging/pharmacy generally bundle into the DRG.
- **New phase — AR-DRG grouper integration:** assemble the grouper MDS (ICD-10-AM PDx + AdxDx, ACHI procedures, age, sex, LOS, ventilation hours, separation mode, same-day, newborn weight), call the CHI-approved grouper, persist returned DRG + version, set journey `grouped`.
- **Phase 6 (claim):** IP claim carries the DRG and bundled price; OP claim carries SBS item lines. Both serialize to NPHIES FHIR.
- **New phase — VBHC PROMs/PREMs:** instrument + response capture (generic PROMIS-10, disease-specific for cataract/obesity/diabetes/pregnancy), patient-app delivery, and submission as the NPHIES PRM MDS.

Approve and Lovable ships the migration first for review, then the code batch. After Phase 0 verifies green, Phase 1 is Beneficiary + Coverage + FHIR Patient/Coverage.