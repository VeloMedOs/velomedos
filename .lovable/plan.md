# Phase 6 — Clinical Coding + AR-DRG Grouper Integration — REVISED

Coder workflow + external AR-DRG grouper for **inpatient (IMP) encounters only**. OP/ER skip this phase and go straight to itemized SBS claims in Phase 7. Standing rule: **API-first, fully wired.**

> Lovable's draft was strong (supersede trigger, idempotent regroup, env-driven external grouper with no grouping logic, IMP-only guard). Changes tagged **[AMENDED]** / **[NEW]**.

## 1. Database migration

Two tenant-scoped tables, 4-step pattern + `touch_updated_at`.

`clinical_coding` — one row per encounter (unique `encounter_id`)

- `tenant_id`, `encounter_id` (unique fk), `coder_id`, `status text (in_progress|coded|amended)` default `in_progress`, `principal_diagnosis_id fk→encounter_diagnosis NULL`, `coded_at`, `notes`, audit cols.

`drg_assignment` — historical (many per encounter, one `assigned`)

- `tenant_id`, `encounter_id fk`, `drg_id fk→drg NULL` **[AMENDED — NULLABLE. The grouper returns a** `drg_code`**; resolve** `drg_id` **by lookup on** `(drg_code, version)`**, but** `drg` **is empty until the CHI file loads (Phase 3) and the stub returns** `F62B`**. A NOT NULL FK would fail the insert. Always snapshot the code; bind the FK when the reference exists.]**, `drg_code text NOT NULL` (snapshot), `drg_version text NOT NULL`, `mdc`, `adrg`, `partition`, `complexity_score numeric`, `grouper_name`, `grouper_version`, `grouper_request jsonb`, `grouper_response jsonb`, `assigned_at` default now(), `status text (assigned|superseded)` default `assigned`.
- Partial unique: one `assigned` per `encounter_id`. Trigger: a new `assigned` marks prior `assigned` rows `superseded`.

**Journey triggers** (existing monotonic `encounter_advance_journey`):

- `clinical_coding` status `coded` → advance to `coded`.
- `drg_assignment` status `assigned` → advance to `grouped`.

RLS: `is_tenant_member(auth.uid(), tenant_id)`.

## 2. Zod schemas — `src/lib/mds/schema/coding.ts`

- `CodingFinalize { principal_diagnosis_id: uuid, notes? }`; server sets `status='coded'`, `coded_at`, `coder_id`.
- `GrouperRunRequest { force?: boolean }`.

## 3. Grouper module — `src/lib/mds/grouper.ts`

`buildGrouperMds(encounterId)` assembles inputs from the **correct existing sources** **[AMENDED]**:

- principal Dx (ICD-10-AM) from `encounter_diagnosis` where `role='principal'`.
- additional Dx[] from remaining `encounter_diagnosis`, **each with its** `present_on_admission` **flag** **[NEW — ECC complexity input; complication vs comorbidity]**.
- procedures (ACHI) from `charge_item` **where** `encounter_id=X AND achi_code IS NOT NULL` (the Phase-4 snapshot), distinct by `achi_code` — covers service + EP order procedures. **[AMENDED — the order-item tables don't carry** `code_system`**; the ACHI code is snapshotted on** `charge_item`**]**
- `age` computed **at admission** (`admitted_at − beneficiary.dob`), plus `age_days` for neonates; `sex` from `beneficiary`. **[AMENDED — age at admission, not now]**
- `los_days` from `encounter_hospitalization.length_of_stay_days`; `same_day`, `mechanical_ventilation_hours`, `separation_mode` from `encounter`.
- `birth_weight_grams` from `beneficiary.birth_weight_grams` (the Phase-1 column). **[AMENDED — not a** `clinical_supporting_info` **category, which doesn't exist]**

`callGrouper(mds)`: **stub** mirroring the NPHIES-gateway shape; reads `GROUPER_ENDPOINT` / `GROUPER_API_KEY` at call time; when unset returns a deterministic stub (`{ drg_code:"F62B", drg_version:"AR-DRG v9.0", mdc:"05", adrg:"F62", partition:"M", complexity_score:1.0, grouper_name:"stub", grouper_version:"0" }`). Pure assembly + HTTP; **no grouping logic (licensed/external).**

## 4. Server routes (3 new under `src/routes/api/clinical/v1/`)

POST routes: `requireClinicalRole(["coder","physician","case_manager"])` + class check rejecting non-IMP with `409 class_forbidden`.

- `encounters.$id.code.ts` — GET current row; POST `CodingFinalize` → `status='coded'`. Pre-checks: **encounter is discharged (**`discharged_at` **set / journey ≥** `discharged`**), else** `409 not_discharged` **[NEW — AR-DRG codes a completed episode; LOS/separation must be final]**; principal Dx exists, else `409 missing_principal_dx`.
- `encounters.$id.group.ts` — POST. Requires journey ≥ `coded`, else `409 not_coded`. Idempotent unless `force` (then new `assigned` + supersede prior). `buildGrouperMds` → `callGrouper` → insert `drg_assignment` (resolve `drg_id` by best-effort lookup on `(drg_code, drg_version)`; leave NULL if unmatched). Audited.
- `encounters.$id.drg.ts` — GET current `assigned` assignment + history.

## 5. OpenAPI — `src/lib/openapi-clinical-spec.ts`

Tag **"Coding"**; paths `/encounters/{id}/code` (GET/POST), `/group` (POST), `/drg` (GET); 409 envelopes for `class_forbidden`, `not_discharged`, `missing_principal_dx`, `not_coded`.

## 6. State-machine note

`coded`(6)/`grouped`(7) already in `JOURNEY_RANK`. Both advancements use the monotonic `encounter_advance_journey()` helper — re-coding/re-grouping never regresses state.

## 7. Acceptance

1. Discharged IP encounter with principal Dx → `POST /code` → journey `coded`.
2. Coding a **non-discharged** encounter → `409 not_discharged`. **[NEW]**
3. `POST /group` → DRG (stub) + version persisted, journey `grouped`; `drg_id` NULL when reference not loaded, `drg_code` snapshot present. **[AMENDED]**
4. Re-`group` without `force` idempotent; with `force` adds `assigned`, supersedes prior.
5. OP/ER encounter → both POSTs `409 class_forbidden`.
6. Encounter without principal Dx → `409 missing_principal_dx`.
7. `buildGrouperMds` output includes POA per additional Dx, ACHI procedures from `charge_item`, birth weight from `beneficiary`, age computed at admission. **[NEW]**
8. Typecheck clean; routes in `routeTree.gen.ts`.

- **API coverage:** `clinical_coding` → code; `drg_assignment` → group (write) + drg (read). No orphan tables.

## 8. Delivery & Documentation milestone (standing DoD)

- `docs/his-technical-manual.md` — add the coding + grouper data model (`clinical_coding`, `drg_assignment`, supersede trigger), the **grouper MDS input contract** (exact source table/column for each field: principal/additional Dx + POA from `encounter_diagnosis`, ACHI from `charge_item.achi_code`, LOS from `encounter_hospitalization`, ventilation/separation/same_day from `encounter`, birth weight + age-at-admission from `beneficiary`), the external grouper integration (env vars, request/response shape, "no grouping logic — licensed"), and the `drg_id` best-effort binding. This contract is the thing future phases must diff against.
- `docs/his-user-manual.md` — coder task guides: "Finalize coding (principal + additional Dx, POA)", "Run the DRG grouper", "Re-group an amended episode"; what `superseded` means; why grouping requires discharge.
- `docs/changelog.md` — Phase 6 entry.

## Files touched

- Migration: `clinical_coding`, `drg_assignment` (+ nullable `drg_id`) + triggers/RLS/GRANTs
- New: `src/lib/mds/schema/coding.ts`, `src/lib/mds/grouper.ts`, `src/routes/api/clinical/v1/encounters.$id.code.ts | .group.ts | .drg.ts`
- Edited: `src/lib/openapi-clinical-spec.ts`; `docs/his-technical-manual.md | his-user-manual.md | changelog.md`

Out of scope (later): DRG bundle **pricing** (Phase 7 reads `drg_assignment` + `drg_base_rate` + `drg_price_adjustment`), claim assembly (Phase 7), strict validation (Phase 10), real grouper endpoint (wire when the CHI-approved grouper contract is available).

&nbsp;