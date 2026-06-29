# Phase 7 — Claim Assembly + FHIR Bundle — REVISED

Billing layer on Phase 6's coded/grouped encounters. Branches by `encounter.reimbursement_model`: OP/ER → itemized SBS; IP → AR-DRG bundle. Produces the FHIR Claim bundle (unified health file) + a stub submission (real gateway = Phase 9). Standing rule: **API-first, fully wired.**

> Lovable's draft was largely right (reimbursement branch, `priceDrg` outliers, one-active-claim guard, cost-only IP snapshot, and it picked up the docs milestone). Changes tagged **[AMENDED]** / **[NEW]**.

## Role prerequisite [NEW]

`biller` is **not** in the Phase-0 `clinical_role` enum. Add it: `ALTER TYPE clinical_role ADD VALUE IF NOT EXISTS 'biller';` (or use the existing `cashier`). Routes below assume `biller` exists.

## Database migration

Tenant-scoped, RLS, GRANTs, audit triggers, monotonic journey advance to `claim_ready`.

- `claim` — header: `encounter_id`, `coverage_id`, `provider_claim_no` (unique per tenant), `invoice_no`, `claim_type` (professional|institutional|pharmacy|oral|vision), `claim_subtype` (op|ip|emergency), `billing_model` (itemized_sbs|drg_bundled), `drg_assignment_id NULL`, totals in halalas (`total_net_minor`, `total_patient_share_minor`, `total_payer_share_minor`, `currency` 'SAR'), `status` (draft|ready|submitted|accepted|rejected), `nphies_response jsonb`, `submitted_at`, `replaces_claim_id uuid NULL fk→claim` **[NEW — resubmission/correction lineage after a rejection; NPHIES wires it in Phase 9]**.
- `claim_item` — line snapshot (OP payer-facing; IP cost-only audit): `sequence_no`, `charge_item_id`, `service_type`, `service_code` (SBS), `non_standard_code`, `description`, `quantity`, `unit_price_minor`, `factor`, `discount_minor`, `tax_minor`, `patient_share_minor`, `payer_share_minor`, `net_minor`, `is_package`, `body_site`, `sub_site`, `cost_only bool`.
- **Claim-level sequenced MDS arrays (snapshotted)** **[NEW — NPHIES requires these; items reference their sequences]**:
  - `claim_diagnosis` — `claim_id`, `sequence_no`, `icd10am_code`, `display`, `role`, `present_on_admission`.
  - `claim_care_team` — `claim_id`, `sequence_no`, `practitioner_ref`, `role`, `speciality`.
  - `claim_supporting_info` — `claim_id`, `sequence_no`, `category`, `code`, `value`, `unit`, `timing`. Populated from `vitals_observation` **+** `clinical_supporting_info` — this is the CHI-mandated MDS the payer requires (Phase 10 rejects claims missing it).
- `claim_item_link` — `claim_id`, `item_sequence_no`, `link_type` (diagnosis|care_team|supporting_info), `target_sequence_no` → **references the claim-level sequence arrays above, not the encounter tables' rank** **[AMENDED]**.

Triggers: `claim_advance_journey` (status ready/submitted → journey `claim_ready`/`submitted`, monotonic); one-active-claim-per-encounter partial unique (status in draft|ready|submitted|accepted) — a `rejected` claim allows a new one (resubmission).

## Pricing & assembly libs

- `src/lib/mds/drg-pricing.ts` — `priceDrg(encounterId)`: resolve `drg_base_rate` by `(payer_id, network_id, drg_version)`; `base = round(base_rate_minor * drg.relative_weight)`; apply `drg_price_adjustment` by `priority` (outliers vs LOS/cost trims, short-stay per-diem, ICU, same-day) via `pricing_rule scope='drg_outlier'`; **then apply the plan copay/deductible (**`pricing_rule scope='share'`**) to split the bundle into patient vs payer share** **[AMENDED — was undefined]**. Returns `{ payer_share_minor, patient_share_minor, net_minor, applied_adjustments[] }`.
- `src/lib/mds/claim-assembly.ts`:
  - `assembleItemized(encounterId)`: project `charge_item` → `claim_item` (sequenced); build `claim_diagnosis` (from `encounter_diagnosis`), `claim_care_team` (from `encounter_care_team`), `claim_supporting_info` **(from** `vitals_observation` **+** `clinical_supporting_info`**)**, then `claim_item_link` rows referencing those claim-level sequences; sum totals. **[AMENDED — +supporting info]**
  - `assembleDrgBundle(encounterId)`: same claim-level diagnosis/careTeam/supportingInfo build; attach `drg_assignment_id`; totals from `priceDrg`; snapshot `charge_item` as `claim_item` `cost_only=true` (audit detail, not the payer bill).
- `src/lib/mds/fhir/claim.ts` — FHIR R4 `Bundle` (type=collection): `Claim` + `Patient`, `Coverage`, `Encounter`, `Condition`s, `CareTeam`, `Claim.supportingInfo[]` **from** `claim_supporting_info`, and either `Claim.item[]` (OP) or the DRG package line (IP). **[VERIFY — NPHIES institutional DRG profile: does the IP claim submit the DRG package line only, or itemized lines + a DRG indicator? Structure** `claim_item`**/FHIR to match the KSA institutional claim IG before shipping.]**
- `src/lib/mds/schema/claims.ts` — `ClaimCreate`, `ClaimAssembleRequest`, `ClaimSubmitRequest`.

## API routes (`src/routes/api/clinical/v1/`)

`requireTenant` / `requireClinicalRole(['biller','coder','tenant_admin'])`, audit, envelope.

- `encounters.$id.claim.ts` — POST assemble. Guards: **OP requires** `encounter.status='finished'` **[AMENDED — was clinically_documented+; bill only a completed visit]**; IP requires `journey_state >= grouped`. Branch on `reimbursement_model`. Idempotent unless `?force=true`. Sets `status='ready'`, journey `claim_ready`. GET = current active claim.
- `claims.ts` — GET list (status, billing_model, encounter_id, date range, pagination).
- `claims.$id.ts` — GET detail (header + items + claim-level arrays + links); PATCH/DELETE (draft only).
- `claims.$id.items.ts` — GET items.
- `claims.$id.fhir.ts` — GET → FHIR Bundle (unified health file).
- `claims.$id.submit.ts` — POST stub: validates `status='ready'`, sets `submitted`, writes synthetic `nphies_response`, journey `submitted`. Real gateway Phase 9.

## OpenAPI

Tags `Claims`, `FHIR Claim`; paths for all routes; schemas `Claim`, `ClaimItem`, `ClaimDiagnosis`, `ClaimCareTeam`, `ClaimSupportingInfo`, `ClaimItemLink`, `FhirClaimBundle`, `DrgPricingResult`.

## Acceptance

1. OP (status=finished) with charge_items → claim `itemized_sbs`; totals = Σ `charge_item.net_minor`; FHIR `Claim.item[]` match; `Claim.supportingInfo[]` **carries vitals + notes**. **[AMENDED]**
2. IP (grouped) → `drg_bundled`; `payer_share = base_rate*relative_weight ± adjustments`, **patient share = plan copay/deductible on the bundle**; `applied_adjustments` traceable; FHIR exposes DRG line; `claim_item` rows `cost_only`. **[AMENDED]**
3. Assembling an OP encounter not yet `finished` → 409. **[NEW]**
4. Submit `ready` → `submitted`, journey `submitted`.
5. Typecheck clean.

- **API coverage:** `claim`→encounters.$id.claim + claims(.$id); `claim_item`→claims.$id.items; `claim_diagnosis`/`claim_care_team`/`claim_supporting_info`/`claim_item_link`→ claims.$id detail + fhir. No orphan tables.

## Delivery & Documentation milestone (standing DoD)

- `docs/his-technical-manual.md` — Phase 7: claim data model (header + line + the three claim-level sequenced arrays + links), the **DRG pricing algorithm with worked OP and IP examples** (normal case, a high-cost outlier trim, a short-stay per-diem, and the copay/deductible split), FHIR bundle composition incl. SupportingInfo projection, the OP-finished / IP-grouped preconditions, and the NPHIES IP-claim-structure decision once verified.
- `docs/his-user-manual.md` — biller workflow: assemble → review → submit; why IP totals come from the DRG bundle not line sums; what `cost_only` lines mean; resubmitting a rejected claim.
- `docs/changelog.md` — Phase 7 entry.

## Files touched

```
supabase migration (claim + claim_item + claim_diagnosis + claim_care_team + claim_supporting_info
                    + claim_item_link; biller enum value; triggers/RLS/GRANTs)
src/lib/mds/drg-pricing.ts        (new; outliers + share split)
src/lib/mds/claim-assembly.ts     (new; +supporting-info projection, claim-level sequences)
src/lib/mds/fhir/claim.ts         (new; +SupportingInfo; IP structure per NPHIES IG)
src/lib/mds/schema/claims.ts      (new)
src/routes/api/clinical/v1/encounters.$id.claim.ts | claims.ts | claims.$id.ts |
   claims.$id.items.ts | claims.$id.fhir.ts | claims.$id.submit.ts   (new)
src/lib/openapi-clinical-spec.ts  (extend: tags + schemas + paths)
docs/his-technical-manual.md | his-user-manual.md | changelog.md      (update; worked pricing examples)

```

Out of scope (later): real NPHIES submission + adjudication reconciliation (Phase 9); strict CHI/NPHIES validation (Phase 10); claims UI (Phase 8).

&nbsp;