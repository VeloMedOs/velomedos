# Phase 10 — Validation Hardening (Strict CHI/NPHIES + AR-DRG + RCM) — REVISED

The consolidation phase: strict, claim-type-aware gates so a claim can't be marked `ready` (nor an encounter advance to `claim_ready`) unless **all** CHI/NPHIES MDS, AR-DRG, **and RCM** completeness rules pass. Exposes a completeness API the UI uses to show exact missing items.

> Lovable's draft is right for the clinical spine but was written **without knowledge of the RCM track (R1–R7)** — it validates none of the rules those phases declared. It also has three schema-drift errors. Changes tagged **[AMENDED]** / **[NEW]**; the clinical rule sets are kept.

## A. Schema-drift corrections [AMENDED — match what we actually built]

1. **Supporting-info categories** use the DB enum (underscores), not hyphens. The validator checks `history_of_present_illness`, `physical_examination`, `treatment_plan`, `patient_history`, `investigation_result` (Phase 2), and the **vitals come from** `vitals_observation` **columns** (`temperature_c`, `heart_rate_bpm`, `respiratory_rate_bpm`, `systolic_mmhg`, `diastolic_mmhg`, `spo2_pct`, `weight_kg`, `height_cm`) — **not** `clinical_supporting_info` categories like `temperature`/`pulse`/`vital-sign-systolic`, which don't exist in our model. Map to NPHIES hyphenated codes only at the FHIR/claim boundary (the Phase-7 mapper), never in the DB check.
2. **DRG trim columns** are `drg.low_trim_los` / `drg.high_trim_los` (Phase 3), not `low_trim_day`/ `high_trim_day`. LOS source is `encounter_hospitalization.length_of_stay_days` (Phase 5 generated col).
3. **Roles**: the enum has `coder`, `biller`, `physician`, `tenant_admin`, `rcm`, `case_manager`, `claims_officer`, `finance`, `front_office`, `cashier` — **not** `clinician`/`billing`/`admin`. Completeness endpoint gate: `['coder','physician','biller','case_manager','rcm','tenant_admin']`.
4. `condition_onset` lives on `encounter_diagnosis` (per-diagnosis), not `encounter_hospitalization.onset`.

## B. `src/lib/mds/validation.ts` — clinical rule engine (KEEP, corrected)

`validateClaimReadiness(ctx, {claim, encounter, hospitalization?, drg?, diagnoses, supportingInfo, vitals, items}) -> { ok, missing: MissingItem[] }`. Rule sets:

- **Professional-OP / EMR / Institutional-IP** require the narrative categories (above) + the vitals columns populated before `ready`.
- **Encounter-class allow-list** per claim type (IP→IMP; OP→AMB; EMR→EMER).
- **Diagnoses**: exactly one `role='principal'`; IP requires `condition_onset` per diagnosis.
- **Emergency disposition** required when `cause_of_death ∈ (DED,DOA)` or EMER with end date.
- **DRG (IP)**: active non-superseded `drg_assignment`; PDx present + matches the assignment; intervention-partition DRG → ≥1 ACHI code on the claim (from `charge_item.achi_code`/coding); `length_of_stay_days` within `drg.low_trim_los`/`high_trim_los` **or** an outlier `drg_price_adjustment` applied; `drg_assignment.drg_version` == active `ar-drg` `code_system.version`.
- **SupportingInfo present on the claim** (`claim_supporting_info`) — the Phase-7 projection of vitals + notes must exist, not just the source rows. [NEW — the MDS payload, not just capture]

## C. RCM rule engine — `src/lib/rcm/validation.ts` [NEW — consolidates R1–R7 declared contributions]

A parallel validator keyed by financial type / process stage, gating the RCM transitions:

- **R1 Eligibility**: insured registration requires a resolved `visit_eligibility` (eligible or an approved exception); eligibility unique per visit; insured charging blocked past policy expiry.
- **R2 Authorization**: a `need_approval` service/medicine can't be executed/billed without an `approved`/`partially_approved` authorization covering it (qty within approved); auth `valid_to` not expired and policy not expired at execute/charge; partial approval → only approved qty billable.
- **R3 OP accounting**: bill lines executed-only; eligibility re-checked when `bill_date > visit_date`; discounts self-pay only within role privilege + cap + window.
- **R4 IP accounting**: admission gated on validity+eligibility+approval+bed entitlement; bed covered by Class/TOB (or upgrade path); higher-bed-category transfer preauthorized; discharge blocked while orders pending/unexecuted/undispensed; insured IP bill = DRG bundle (not itemized sum).
- **R5 Claims/Remittance/Denial**: claim can't batch/submit unless readiness gate passes (executed- only + eligibility ref + approvals linked + attachments + scrub clean + snapshot locked); batch at claim-sequence level segregated by integration type; remittance posting finance-permission-gated; resubmission links via `replaces_claim_id`; denial write-off permission+audit.
- **R6 Deposits** / **R7 Cash/ZATCA** contributions fold in when those phases land (R7: a B2C invoice isn't issued without a ZATCA-valid VAT structure; cash session must balance before close).

`MissingItem = { code, category, stage (mds|drg|rcm), message, severity:'error'|'warning' }`.

## D. Wire as guards (both engines)

- `draft → ready` and `…/ready`: run **both** `validateClaimReadiness` + the R5 claim-readiness RCM rules; `ok=false` → 422 `{ error, code:'mds_incomplete'|'rcm_incomplete', request_id, missing }`.
- `…/submit`: defensive re-validate (clinical + RCM).
- Execution/charge gates: R2 (need-approval), R3 (eligibility re-check), R4 (admission/discharge) enforced at their routes via `src/lib/rcm/validation.ts`.
- DB `encounter_advance_journey` stays monotonic; rich validation in the API layer.

## E. Completeness probes

- `GET /claims/:id/completeness` — `{ claim_type, ok, missing[], drg:{required,present, grouper_version_ok,los_ok}, rcm:{eligibility_ok, auth_ok, executed_only_ok, snapshot_locked} }`.
- `GET /encounters/:id/rcm-readiness` [NEW] — pre-claim RCM gate state for the worklists/UI.
- Both read-only, `serviceClient()` via `loadClaimReadinessBundle` / `loadRcmReadinessBundle`, tenant-scoped.

## F. OpenAPI / Frontend

- OpenAPI: `/claims/{id}/completeness`, `/encounters/{id}/rcm-readiness`; document `422 mds_incomplete` and `422 rcm_incomplete` on `/ready` and `/submit`.
- UI: `<ClaimCompletenessPanel>` lists missing items grouped by **stage** (MDS / DRG / RCM) with severity badges; disables "Mark Ready" while errors exist; renders returned `missing[]` on 422.

## G. Acceptance

- Clinical: claim missing a mandated narrative category or a vitals reading → blocked, precise items; IP without current `drg_assignment` / mismatched grouper version / missing ACHI on intervention DRG / LOS outside trim without an outlier → blocked, named. **[corrected column/enum names]**
- RCM: insured claim without resolved eligibility, or a need-approval item without authorization, or a non-executed line, or an unlocked snapshot → blocked with `rcm_incomplete` + named items. **[NEW]**
- Probes return the same `missing[]` the UI shows, grouped by stage.
- OP/ER claim with vitals + treatment plan + principal diagnosis + valid class + eligibility passes.
- No new tables; existing routes untouched except the gated transition points.

## H. Delivery & Documentation milestone (standing DoD)

- `docs/his-technical-manual.md` — the consolidated validation model: the clinical rule sets, the RCM rule sets mapped to their source phase (R1–R7), the two validators, the gate points, the completeness probe contracts, the corrected column/enum references.
- `docs/his-user-manual.md` (clinical) + `docs/his-rcm-user-manual.md` (RCM) — "Why a claim is blocked and how to clear it", per stage (missing vitals/notes/DRG vs missing eligibility/auth/ executed-only), for clinician vs RCM/biller audiences.
- `docs/changelog.md` — Phase 10 entry.

## Files

New: `src/lib/mds/validation.ts`, `src/lib/mds/claim-loader.ts`, `src/lib/rcm/validation.ts`, `src/routes/api/clinical/v1/claims.$id.completeness.ts`, `src/routes/api/clinical/v1/encounters.$id.rcm-readiness.ts`, `src/components/clinical/ClaimCompletenessPanel.tsx`. Modified: `claims.$id.ready.ts`, `claims.$id.submit.ts` (+ RCM re-validate), the R2/R3/R4 execution/ charge routes (wire RCM guards), `openapi-clinical-spec.ts`, `clinical.tsx`.

Phase 11 (VBHC PROMs/PREMs) is next.

```

```