# Phase 11 — VBHC PROMs / PREMs — REVISED

CHI's value-based outcomes layer: PROMs + PREMs, generic PROMIS-10 + disease-specific (cataract/ obesity/diabetes/pregnancy), captured via patient app / SMS, scored deterministically, surfaced on an outcomes dashboard, packaged for NPHIES PRM MDS submission.

> Lovable's plan is largely right and matches the master-doc Phase 11. Changes tagged **[AMENDED]** / **[NEW]** — mainly aligning the PRM submission to the **shared Phase-9 gateway** (which we reframed from claim-only to a message-aware transport) instead of a parallel stub.

## 1. Database (one migration)

- `prom_instrument` (catalog; `tenant_id` nullable for platform-seeded): `key`, `name`, `kind` ('generic'|'disease_specific'|**'experience'**) **[AMENDED — fold PREM instruments here for consistency instead of free-text** `instrument_key`**]**, `condition` nullable, `version`, `active`, `schema jsonb`.
- `prom_assignment`: `beneficiary_id`, `episode_of_care_id?`, `encounter_id?`, `instrument_id`, `trigger` (pre_op|post_op|baseline|followup), `due_at`, `status`, `channel` (app|sms), reminder fields, `assigned_by`.
- `prom_response`: `assignment_id`, `answers jsonb`, `score jsonb`, `instrument_version` (stamped), `collected_at`, `source`. Trigger flips assignment `completed`.
- `prem_response`: `encounter_id?`, `beneficiary_id`, `instrument_id fk` **[AMENDED — was free-text** `instrument_key`**]**, `answers jsonb`, `score jsonb`, `collected_at`, `source`.
- **No** `prom_submission_attempt` **table** **[AMENDED — reuse the Phase-9** `nphies_message` **log; PRM is just another message type through the shared gateway]**.
- Seed platform instruments (`tenant_id=null`): PROMIS-10 v1.2 (generic), Cataract PROM v1, and a generic **PREM v1** (kind='experience').

## 2. Scoring engine — `src/lib/mds/prom-scoring.ts`

Pure deterministic per instrument: `scorePromis10` (published raw→T-score tables for Global Physical/ Mental Health), `scoreCataractProm`, PREM aggregate, dispatcher `scoreProm(key, answers)`, answer validation against `schema.items`. Snapshot: score + answers written once, `instrument_version` stamped, never recomputed.

## 3. API (`/api/clinical/v1/`)

- `prom-instruments` GET (tenant + platform) / POST (superadmin).
- `prom-assignments` GET/POST; `…/:id/remind`, `…/:id/respond` (score server-side, persist, complete), `…/:id` GET.
- `prem-responses` POST.
- `outcomes/summary?condition&from&to` — mean PCS/MCS + PREM by month, case-mix-adjusted (age band + principal-diagnosis chapter), vs platform benchmark.
- `prom-assignments/:id/submit` **[AMENDED]** — build the NPHIES **PRM MDS** bundle and send via the **shared Phase-9** `gateway.sendBundle(bundle, { type:'prm' })`; log via `nphies_message`; sandbox until creds. (Verify the bundle against the NPHIES PRM/CS profile.)

## 4. Patient-app delivery

`/api/patient/v1/proms/pending` (signed-in beneficiary's pending assignments) + `/respond` proxy; `PromSurveyRenderer` drives items from `instrument.schema`. (Wired into the patient app's Learn surface — see the revised patient-app prompt.)

## 5. Staff / Superadmin UI

`OutcomesPane` ("VBHC" tab in the clinical workspace): assignments table + assign modal + response viewer + PRM submit. `OutcomesDashboard` route: mean PCS/MCS by month per condition, PREM bars, case-mix-adjusted vs benchmark. Superadmin cross-tenant variant.

## 6. Wiring

Side-nav entries; extend `ClinicalAPI`; `clinicalAudit` on state changes.

## 7. Acceptance

PROMIS-10 + Cataract seeded; assign Cataract PROM (post_op) to a cataract episode; respond → PCS/MCS computed + stored + assignment completed; dashboard shows the point; `…/submit` logs an `nphies_message` (sandbox) **[AMENDED — not a separate attempt table]**.

## 8. Delivery & Documentation milestone (standing DoD)

- `docs/his-technical-manual.md` — PROM/PREM data model, scoring engine + snapshot/versioning, the outcomes aggregation + case-mix method, and the PRM-over-shared-gateway submission path.
- `docs/his-user-manual.md` — clinician/case-manager "Assign a PROM", "Read outcomes", VBHC dashboard; patient-side survey flow cross-refs the patient-app manual.
- `docs/changelog.md` — Phase 11 entry.

## Technical notes

- Platform instruments (`tenant_id=null`) visible to all; tenant instruments private; RLS `tenant_id IS NULL OR is_tenant_member(...)`.
- PROMIS T-score tables reproduced from the public PROMIS scoring manual (permitted; not a clinical grouper).
- No changes to claim/encounter/DRG tables; PROMs link by `episode_of_care_id`/`beneficiary_id`.

```

```