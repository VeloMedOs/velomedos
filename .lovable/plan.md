# Step 1 — Gate + Rule Engine v2.2 + Foundation + PBM (CORRECTED — validated against repo @112cc51)

Ships **BatchB_01 Rule Engine v2.1** + **BatchC_01 Foundation+PBM v1.0** + **Addendum 1** (referral rule scope, maternity schema fix, migration hygiene). Data & engine layer only — no new page routes. All new panes hang off `src/routes/_authenticated/clinical.tsx` via `src/components/clinical/daylight/nav-config.ts`.

## Scope boundary

- **In:** DB schema + functions + triggers, TS engines, API endpoints, spine components (`<BilledGate>`, `<FormsGate>`, `<RcmCommCard>`, `<HimCommCard>`), worklist views, RCM Admin pane + cards, config registry, referral tables (data only), maternity schema fixes, PBM formulary + drug↔indication + rules R-PBM1–6.
- **Out (later steps):** OPD screens (Step 4), Referral screens/Rule Engine admin cards (Step 5), Scheduling views (Step 3), Clinical Spine worklist shells (Step 2 — this step provides only the primitives + views they consume).

## Repo facts you must respect (verified — do not re-derive)

- Order-item tables (`lab_order_item`, `radiology_order_item`, `service_order_item`, `ep_order_item`) use enum `clinical_order_status = ('ordered','in_progress','completed','cancelled')`. There is **no** `collected`/`resulted`/`dispensed` value on these tables. `prescription_item` has **no status enum** — it has `dispense_status text` (nullable, unconstrained).
- `charge_item.status` uses enum `charge_status = ('ordered','collected','in_progress','resulted','dispensed','cancelled')` — do not confuse the two.
- `pricing_rule.scope` is enum `pricing_rule_scope = ('eligibility','share','package','substitution','drg_outlier','out_of_network')`. `approval_rule.scope`, `need_approval_rule.scope`, `not_covered_rule.scope` are plain `text NOT NULL` with **no CHECK** — they need **no DDL** to accept `'referral'`.
- `clinical_role` already contains: registrar, physician, nurse, **lab_tech**, **radiologist**, **pharmacist**, coder, case_manager, cashier, tenant_admin, read_only, front_office, rcm, approval_officer, claims_officer, finance, biller. Do **not** add `lab_technician` — use existing `lab_tech`.
- `wallet_txn.source` has CHECK `('credit_note','refund','manual','apply_to_bill','deposit_convert')`; `amount_minor` has CHECK `> 0` with a separate `direction ('credit','debit')` column. `patient_wallet.balance_minor` is application-maintained (no balance trigger exists).
- `service_master` already has `body_site` — do not re-add it.
- `episode_of_care.status` CHECK is `('active','finished','cancelled')` (auto-named `episode_of_care_status_check`); `care_type text` exists and is nullable.
- `maternity_protocol` has `payer_id` + `policy_id` but no `class_id`; it has **no** `type` or `expected_end` columns and none may be created.
- `src/lib/mds/rules.ts` exports `loadRules()` and `evaluate()` with a hardcoded `RuleScope` TS union. There is **no** `evaluateTriggers()` yet.
- `src/components/superadmin/` has **no RCM Admin pane** — you will create one and register it in `SideNav.tsx`.
- Order-item PATCH handlers: `src/routes/api/clinical/v1/orders/{lab,radiology,service,ep,prescription}-items.$id.ts`, built via `_order-factory.ts`.
- Authorization decisions are written in `src/routes/api/clinical/v1/auth/requests.$id.decision.ts` (and NPHIES responses via `requests.$id.submit.ts`).
- `ip_daily_charge_run` and `los_extension` are **tables**; they are written by `src/routes/api/clinical/v1/ip/admission-requests.$id.action.ts` — that action handler is the PBM hook wiring point.
- `nav-config.ts`: Orders (line ~44) and Results (~45) are `disabled: true` — enable both. `Vitals trend` (~71) stays disabled (later step).
- `is_tenant_member(auth.uid(), tenant_id)` is the standard RLS helper — use it in all new policies.

---

## 1. Migration ordering (each in its own file — R1 enum lesson)

Every enum / CHECK change ships in a **separate** migration ordered before its consumers. Submit via the migration tool one at a time, in order, awaiting approval before the next.

```
M01_enums_gate_and_exceptions.sql
  - CREATE TYPE rcm_gate_state AS ENUM ('locked','released_by_exception','billed')
  - CREATE TYPE rcm_gate_exception_type AS ENUM (
      'emergency_override','partial_deposit_override','installment_override',
      'clinical_urgency','mrp_verbal_order','newborn_inherit',
      'ineligibility_workflow','config_no_auth','indication_override','admin_override')
  - CREATE TYPE rcm_gate_reason_code AS ENUM (…)

M02_enums_batchC_roles.sql
  - ALTER TYPE public.clinical_role ADD VALUE IF NOT EXISTS '<v>' for ONLY:
      lab_doctor, bb_technician, bb_physician, rad_technician,
      or_nurse, cath_nurse, anesthetist, labour_nurse, nursery_nurse, injection_staff
  - Do NOT add pharmacist / radiologist (exist) or lab_technician (use existing lab_tech)

M03_enums_scheduling_and_referral.sql
  - CREATE TYPE booking_source AS ENUM ('opd','referral','follow_up','call_center','portal')
  - CREATE TYPE visit_type AS ENUM ('new_consult','follow_up','series','no_charge','procedure')
  - CREATE TYPE slot_status AS ENUM ('open','held','booked','blocked','cancelled')
  - CREATE TYPE referral_class AS ENUM ('intra','inter_company','external','cross_encounter')
  - CREATE TYPE target_kind AS ENUM ('specialty','provider','facility','service')
  - CREATE TYPE charge_mode AS ENUM ('new_consult','follow_up','series','no_charge')
  - CREATE TYPE referral_status AS ENUM ('draft','submitted','accepted','declined','completed','cancelled')
  (none of these type names exist in the repo — verified)

M04_maternity_status_extend.sql
  - ALTER TABLE public.episode_of_care DROP CONSTRAINT episode_of_care_status_check;
  - ALTER TABLE public.episode_of_care ADD CONSTRAINT episode_of_care_status_check
      CHECK (status IN ('active','finished','cancelled','delivered','transferred'));
  (existing rows unaffected)

M05_pricing_rule_scope_extend.sql
  - ALTER TYPE public.pricing_rule_scope ADD VALUE IF NOT EXISTS 'referral';
  - ALTER TYPE public.pricing_rule_scope ADD VALUE IF NOT EXISTS 'pbm';
  - NOTHING ELSE in this file. approval_rule / need_approval_rule / not_covered_rule
    scope columns are plain text — no DDL needed for them.
  - Both values are consumed later (M08 PBM seeds, M13 referral seeds) — never in this file.

M06_wallet_txn_extend.sql
  - ALTER TABLE public.wallet_txn DROP CONSTRAINT wallet_txn_source_check;
  - ALTER TABLE public.wallet_txn ADD CONSTRAINT wallet_txn_source_check
      CHECK (source IN ('credit_note','refund','manual','apply_to_bill','deposit_convert','emergency_reconcile'));
  - ALTER TABLE public.wallet_txn ADD COLUMN related_exception_id uuid NULL;

M07_billed_gate_core.sql            (rcm_gate_exception + charge_is_billed() + guards + v_order_item_gate)
M08_pbm_formulary_and_indication.sql (chi_formulary, chi_formulary_version, drug_indication_map, R-PBM pricing_rule seeds scope='pbm')
M09_service_master_extensions.sql
M10_rcm_admin_config_registry.sql    (rcm_admin_config + rcm_admin_config_history + seeds)
M11_forms_engine.sql                 (form_def / clinical_form_instance / form_workflow_binding + forms_gate_open())
M12_referral_data_layer.sql          (referral + referral_target — data-only)
M13_maternity_protocol_class_id.sql  (ALTER TABLE maternity_protocol ADD COLUMN class_id uuid NULL REFERENCES insurance_class(id))
M14_seed_referral_rules_A_E.sql      (pricing_rule rows scope='referral' — data seed only)

```

---

## 2. Core tables

`rcm_gate_exception` — id, tenant_id, charge_item_id (nullable for encounter-level), encounter_id, admission_request_id, exception_type (rcm_gate_exception_type), reason_code (rcm_gate_reason_code), granted_by, granted_role, manual_approved_minor bigint, nphies_approved_minor bigint, wallet_delta_minor bigint, reconciled_at timestamptz, expires_at timestamptz, retrospective_auth_state text, created_at/updated_at. RLS via `is_tenant_member`. GRANT SELECT/INSERT/UPDATE/DELETE to authenticated + ALL to service_role **in the same migration as CREATE TABLE**.

`rcm_admin_config` — tenant_id, key text, value jsonb, updated_by; audit via `rcm_admin_config_history` (who/when/old→new). Seed defaults: `ip_deposit_min_percent=35`, `self_pay_release='full'`, `override_roles=['rcm']`, `er_supply_days_max=7`, `wallet_block_scope='all_orders'`, `op_dispense_days_max=14`, `installment_policy={}`, `indication_severity_default='block'`.

`patient_wallet` **/** `wallet_txn` — exist; only the M06 changes above. No new wallet tables.

## 3. Predicate + guards

**SQL fn** `public.charge_is_billed(_tbl text, _id uuid) → boolean` — implements the 4 clauses of BatchB_01 §1.1; reads `charge_item` (join via its polymorphic `order_item_table`/`order_item_id`), `authorization_item` (`charge_item_id`, `decision`), `deposit_transaction`, `wallet_txn`, `cash_collection`, `rcm_gate_exception`, `rcm_admin_config` at eval time. Self-pay branch anchors on `visit_eligibility.financial_type = 'self_pay'`. Refund re-lock reads `refund_request`.

**Trigger** `order_item_perform_guard()` — BEFORE UPDATE, using the **actual** status models:

- On `lab_order_item`, `radiology_order_item`, `service_order_item`, `ep_order_item`: if `OLD.status = 'ordered'` and `NEW.status IN ('in_progress','completed')` and `charge_is_billed()` is false and no releasing `rcm_gate_exception` → `RAISE EXCEPTION 'billed_gate: order not billable'`. Transition to `'cancelled'` is always allowed.
- On `prescription_item`: if `NEW.dispense_status = 'dispensed'` and `OLD.dispense_status IS DISTINCT FROM 'dispensed'` under the same failing predicate → same exception.
- Do NOT add `collected`/`resulted` values to `clinical_order_status` in this step; if a later Batch C module needs them, that is its own enum migration.

**Class parameterization:** AMB/EMER → per-order gate; IMP/day-case → admission-level gate via companion `admission_gate_open()` (auth approved + deposit adequacy from `rcm_admin_config.ip_deposit_min_percent` — never hardcode 35), with per-order gating only for auth-required items.

**View** `v_order_item_gate` — unions the four order-item tables + `prescription_item` (mapping `dispense_status` into the same shape); exposes `gate_state ∈ {locked, released_by_exception, billed}`, `reason_code`, `exception_id`, `charge_item_id`. Drives every worklist badge.

**TS mirror** `src/lib/rcm/billed-gate.ts` — same predicate; fixture-tested for parity with the SQL fn.

**API integration** — `src/routes/api/clinical/v1/_order-factory.ts` PATCH pre-checks via TS mirror; returns 403 `{code:'GATE_BILLED'}`. Trigger is defense in depth.

## 4. Emergency reconciliation loop

New module `src/lib/rcm/emergency-reconcile.ts`. Invoke from `src/routes/api/clinical/v1/auth/requests.$id.decision.ts` (and the NPHIES response path in `requests.$id.submit.ts`) when a decision is written for an encounter holding an active `emergency_override` exception:

1. `wallet_delta_minor = nphies_approved_minor − manual_approved_minor`.
2. Post `wallet_txn`: map sign → `direction` ('credit' if delta > 0, 'debit' if < 0), `amount_minor = abs(delta)` (the `> 0` CHECK requires positive amounts), `source='emergency_reconcile'`, `related_exception_id` set. **Update** `patient_wallet.balance_minor` **in the same transaction** — balance is app-maintained, there is no trigger.
3. Set `rcm_gate_exception.reconciled_at`, `nphies_approved_minor`, `wallet_delta_minor`.
4. Next order's `charge_is_billed()` reads wallet balance — negative blocks, positive auto-applies. No new endpoint.

## 5. Forms engine

Tables: `form_def(id, tenant_id, code, version, schema jsonb, age_band jsonb, active)`, `clinical_form_instance(id, tenant_id, form_def_id, encounter_id, order_item_ref, status, answers jsonb, cosigned_by, due_at)`, `form_workflow_binding(id, tenant_id, form_def_id, encounter_class, module, trigger ∈ pre|post, assignee_role, mandatory, cosign_required, due_window_minutes)`.

**Fn** `public.forms_gate_open(_encounter_id, _order_item_ref) → boolean` — reads bindings only, no hardcoded lists. Composition order: **forms gate → billed gate**.

## 6. PBM block

- `chi_formulary` + `chi_formulary_version` — quarterly Excel import staging.
- `drug_indication_map` — full DDL from BatchC_01 §3.1 (COPY-loadable seed).
- R-PBM1..R-PBM6 as `pricing_rule` rows with `scope='pbm'` (M08 — depends on M05 having run).
- **R-PBM2b** in `src/lib/rcm/pbm-engine.ts`, called from prescription-item POST/PATCH (`orders/prescription-items.$id.ts` + the factory); miss → 422 `INDICATION_MISSING` with `indication_override` path writing an `rcm_gate_exception` row for the RCM worklist. PBM issues never block the billed gate (Addendum 1-C).
- ADT hooks (§3.3a–d: admission-med reconciliation, IP daily fill re-price, LOS extension bundle, discharge meds): wire into `src/routes/api/clinical/v1/ip/admission-requests.$id.action.ts` — the handler that writes `ip_daily_charge_run` and `los_extension`. There are no standalone daily-charge/LOS endpoints.

## 7. `service_master` extensions (M09)

ADD COLUMN (all verified absent): `nphies_map_payer_ref uuid` (via `interface_mapping` type `order_tariff_payer`), `category text`, `subcategory text`, `claim_type text`, `is_service_flag bool`, `visit_type text`, `max_qty_per_episode int`, `max_qty_per_visit int`, `max_qty_per_billing int`, `max_qty_per_policy_year int`, `repeat_block_window_days int DEFAULT 14`, `has_report bool`, `performer_role text`, `ordering_specialty_rule jsonb`, `performing_specialty_rule jsonb`, `pregnancy_rule text`, `age_rule jsonb`, `gender_rule text`, `stat_flag bool`, `tat_minutes int`, `approx_perform_minutes int`, `service_consent_form_id uuid`, `validity_start date`, `validity_end date`, `temporary_unavailable bool`, `not_available_category text`, `service_block bool`, `tooth_number text`, `cannot_combine_service_ids uuid[]`, `general_comments text`.

**Do NOT add** `body_site` **— it already exists on** `service_master`**.**

## 8. Rule engine v2.2 wiring (referral scope)

- `pricing_rule_scope` gains `'referral'` + `'pbm'` in M05. The other three rule tables' `scope` is plain text — no DDL; the engine simply starts writing/reading `scope='referral'` rows.
- Seed Rules A–E as `pricing_rule` rows `scope='referral'` (M14):
  - A: target_specialty ≠ source → preauth_required + charge_mode='new_consult'
  - B: same specialty ≤14d → preauth=false, charge_mode='follow_up'
  - C: 14-day rule / MRP shift → no_charge / series (>14d + physio etc.)
  - D: dental → approval before save + class-limit check; bill_date > visit → re-check
  - E: over-booking → alert-only, hard-cap at `overbook_limit`
- In `src/lib/mds/rules.ts`: extend the `RuleScope` TS union with `'referral' | 'pbm'`; extend `RuleFacts` with referral facts (source/target specialty, days_since_last_visit, service class, booking counts); **add a new exported** `evaluateTriggers()` built on the existing `loadRules()` + `evaluate()` returning `{preauth_required, charge_mode, discount, eligibility_check_required, block_reason}`. Do not rename or break `evaluate()` — `pricing.ts` and charge resolvers consume it. Call sites: referral-create, book, visit-open, allocate. Screens/admin UI = Step 5.

## 9. Referral data layer (data-only)

Tables `referral` + `referral_target` per Scheduling Dev Spec §B1 (specialty/provider/facility/service target, charge_mode, referral_class, status — all typed against M03 enums). RLS via `is_tenant_member`. No screens. Consumed later by `clinic_bookings.referral_target_id` (Step 3) and OPD Referrals pane (Step 4).

## 10. Maternity schema micro-migration

- `episode_of_care`: use existing `care_type` column with value `'pregnancy'`; status CHECK extended in M04; `end_date` = EDD.
- `maternity_protocol`: M13 ADDs `class_id uuid NULL REFERENCES public.insurance_class(id)` for payer×class resolution (HCA-0242). Update `masters/maternity-protocols*.ts` handlers + zod to accept it.
- **Do NOT add** `type` **or** `expected_end` — they do not exist and must not be created.

## 11. Spine components

New under `src/components/clinical/daylight/spine/`:

- `BilledGate.tsx` — reads `v_order_item_gate`; disables Perform/Dispense with tooltip; badge colors per RCM standard (locked=crit, released_by_exception=warn, billed=ok — `.clin-pill` classes).
- `FormsGate.tsx` — reads `forms_gate_open()`; composes above `BilledGate` (forms first).
- `RcmCommCard.tsx` — two-way channel card (HCA-0188); red state on open reconciliation.
- `HimCommCard.tsx` — HIM equivalent.

Views: `v_doctor_worklist`, `v_nursing_workbench` (encounter-class-parameterized).

`nav-config.ts`: set `disabled: false` on **Orders** and **Results** only (they are tabs in `clinical.tsx` — no new route files). Leave `Vitals trend` disabled.

## 12. RCM Admin pane + cards

`src/components/superadmin/` has no RCM Admin pane. **Create** `RcmAdminPane.tsx` and register it in `src/components/superadmin/SideNav.tsx`, containing two cards:

1. **Formulary & Indications** — CHI UDF Excel import (staged diff → publish), `drug_indication_map` browser/editor, per-generic block/warn severity, audit trail.
2. **Gate Config Registry** — CRUD over `rcm_admin_config` keys with audit-history side panel (dispensing validity, return windows, cancel-order enable, indication-rule default, deposit %, override roles). All queries tenant-scoped.

## 13. API surface (all `/api/clinical/v1/`)

- `gate/preview` GET — dry-run predicate for a charge_item_id.
- `gate/exceptions` GET/POST/PATCH — issue/close `rcm_gate_exception`, RCM-role guarded.
- `gate/exceptions/$id/reconcile` POST — manual reconciliation trigger.
- `admin-config` GET/PATCH — RCM Admin registry.
- `forms/defs` + `forms/instances` + `forms/bindings` — CRUD.
- `formulary/import` POST — staged diff. `formulary/indications` GET/POST/PATCH/DELETE.
- `referrals` + `referrals/$id/targets` — data-layer only. Follow existing route-file conventions in `src/routes/api/clinical/v1/` (flat dotted filenames or subdir, matching `auth/` and `ip/` patterns).

## 14. Clinical-API + role matrix wiring

- `src/lib/clinical-api.ts`: add `gateApi`, `formsApi`, `formularyApi`, `referralDataApi`, `adminConfigApi`.
- `src/lib/clinical-role-matrix.ts`: capabilities `gate.exception.grant` (rcm/tenant_admin), `gate.exception.reconcile` (rcm/finance), `admin.config.write` (tenant_admin), `formulary.import` (tenant_admin), `formulary.indications.write` (tenant_admin/pharmacist), `forms.def.write` (tenant_admin), `forms.instance.cosign` (physician).
- `src/lib/rcm/validation.ts`: add `GATE_BILLED`, `INDICATION_MISSING`, `IP_DEPOSIT_INSUFFICIENT`, `EMERGENCY_UNRECONCILED`, `FORM_REQUIRED`.

## 15. Definition of Done

- [ ] `charge_is_billed()` SQL + TS mirror return identical booleans on fixtures.
- [ ] Guard raises `billed_gate` on the 4 `clinical_order_status` tables (ordered → in_progress/completed) and on `prescription_item.dispense_status → 'dispensed'`; cancel always allowed.
- [ ] No `collected`/`resulted` values added to `clinical_order_status`.
- [ ] `_order-factory.ts` PATCH returns 403 `GATE_BILLED`.
- [ ] Emergency reconciliation posts direction-correct `wallet_txn` (positive `amount_minor`, sign expressed via `direction`) AND updates `patient_wallet.balance_minor` atomically; both signs verified.
- [ ] `wallet_txn_source_check` rebuilt to include `emergency_reconcile`; `related_exception_id` present.
- [ ] Self-pay full-vs-override paths (partial_deposit / installment) with `granted_role='rcm'`.
- [ ] IP deposit % read from `rcm_admin_config` (no hardcoded 35).
- [ ] Admission/LOS/transfer gates enforced via `admission_gate_open()`.
- [ ] `v_order_item_gate` returns 3-state incl. prescription_item mapping; drives worklist badges.
- [ ] No `ALTER TYPE … ADD VALUE` in the same migration as any consumer; `pricing_rule_scope` gains both `referral` and `pbm` in M05 before M08/M14 seeds.
- [ ] `clinical_role` gains only the 10 genuinely new values; no `lab_technician` duplicate.
- [ ] R-PBM2b blocks unindicated meds (422 `INDICATION_MISSING`); `indication_override` writes an `rcm_gate_exception` row.
- [ ] Referral Rules A–E seeded as `pricing_rule scope='referral'`; new `evaluateTriggers()` returns full payload at 4 hooks; existing `evaluate()` untouched for legacy callers.
- [ ] `episode_of_care_status_check` includes delivered/transferred; `maternity_protocol.class_id` present with FK to `insurance_class`; **no** `type`**/**`expected_end` **columns anywhere**.
- [ ] `service_master` gains the new columns; `body_site` not duplicated.
- [ ] `RcmAdminPane.tsx` created and registered in superadmin `SideNav.tsx` with both cards.
- [ ] Nav items Orders + Results enabled as tabs (`disabled: false`); Vitals trend untouched; no new route files.
- [ ] All new tables ship GRANTs + RLS (`is_tenant_member`) in the same migration as their CREATE TABLE.

## Technical notes

- Migration files submitted one at a time, in the M01→M14 order above; each awaits approval.
- Enum/CHECK migrations always precede their consumers (Postgres cannot add an enum value and use it in the same transaction — R1 lesson).
- PBM issues never block the billed gate (Addendum 1-C).
- All new panes are tabs in `clinical.tsx` via `nav-config.ts` — no new page routes, no `$module` dynamic route.
- Daylight theme only: `.clin-card`, `.clin-pill.warn/ok/crit/info`, `--clin-ink`, canvas `#F5F8FC`.  
  


---

**Previous Corrections that were implemented into this prompt to be aware off [Nothing to disturb, only for your memory and understanding]:**

**1. M05 is the wrong shape — and misses** `'pbm'`**.** Only `pricing_rule.scope` is an enum (`pricing_rule_scope`: eligibility, share, package, substitution, drg_outlier, out_of_network). `approval_rule`, `need_approval_rule`, and `not_covered_rule` all use plain `text NOT NULL` with **no CHECK** — no DDL needed for them at all. Critically, the plan's §6 registers R-PBM1–6 as `pricing_rule` rows with scope `pbm`, but `'pbm'` is not in the enum — the M08 seed would fail. M05 must `ALTER TYPE pricing_rule_scope ADD VALUE` for both `'referral'` **and** `'pbm'`, alone in that migration.

**2. The guard trigger references status values that don't exist on the order-item tables.** The four order-item tables use `clinical_order_status` = `('ordered','in_progress','completed','cancelled')`. The values `collected`/`resulted`/`dispensed` belong to `charge_status` on `charge_item`, and `prescription_item` has no status enum at all — it has `dispense_status text`. The trigger as written would compile but never fire correctly. Corrected logic: block any transition out of `ordered` except → `cancelled` on the four order tables; on `prescription_item`, block `dispense_status` transitioning to `dispensed`. If Batch C lab/rad later needs `collected`/`resulted` states, that's its own enum migration — not this step.

**3. M02 would create duplicate roles.** `pharmacist` and `radiologist` already exist, and `lab_tech` exists — adding `lab_technician` creates a parallel duplicate role that would poison the role matrix. Use existing `lab_tech`; add only: `lab_doctor, bb_technician, bb_physician, rad_technician, or_nurse, cath_nurse, anesthetist, labour_nurse, nursery_nurse, injection_staff` (with `IF NOT EXISTS`, matching repo convention).

**4.** `service_master.body_site` **already exists** — it's in the original CREATE TABLE. Drop it from the §7 ADD list; everything else in that list is confirmed absent.

**5.** `evaluateTriggers()` **doesn't exist.** `src/lib/mds/rules.ts` exports `loadRules()` and `evaluate()`, and the `RuleScope` TS union is hardcoded to the six enum values. The prompt must say: extend the `RuleScope` union with `'referral' | 'pbm'`, extend `RuleFacts`/`RuleOutcome`, and **add** a new `evaluateTriggers()` built on `loadRules`+`evaluate` — otherwise Lovable will hunt for a function that isn't there.

**6.** `wallet_txn.source` **is CHECK-constrained** to `('credit_note','refund','manual','apply_to_bill','deposit_convert')`. Adding `'emergency_reconcile'` means dropping and rebuilding `wallet_txn_source_check` in its own migration — not "add a reason code." Also: `amount_minor` has a `> 0` CHECK with a separate `direction` column, so the reconcile engine must split the signed delta into direction + positive amount. And `patient_wallet.balance_minor` is app-maintained (no balance trigger found), so the engine must update the balance atomically with the txn insert.

**7. There is no RCM Admin pane to put the cards "inside".** `src/components/superadmin/` contains only Cms/Demo/Docs/FeaturedPartners/HisPrivileges/Legal/Ops/Pipeline panes + `SideNav.tsx`. The prompt must instruct: create `RcmAdminPane.tsx` and register it in `SideNav.tsx`, then place the two cards in it.

**8. PBM ADT hooks point at handlers that don't exist as files.** `ip_daily_charge_run` and `los_extension` are tables written by `src/routes/api/clinical/v1/ip/admission-requests.$id.action.ts` — that action handler is the wiring point, not standalone endpoints.

**9. Emergency reconcile wiring point, named precisely:** the authorization response write happens in `src/routes/api/clinical/v1/auth/requests.$id.decision.ts` (plus `requests.$id.submit.ts` for NPHIES round-trips). Name these files or Lovable will guess.

One deliberate confirmation rather than a correction: `Vitals trend` (nav-config line 71) is also disabled — the plan correctly enables only Orders + Results; vitals stays for Step 2/4. Also note the repo head has moved (`112cc51`, "Added MCP server & plugin") — nothing in that commit touches Step 1 surfaces.

Here's the full corrected paste-ready prompt:

Created a file, read a file

Created a file, read a file

The corrected prompt restructures the migration list (now M01–M14: wallet CHECK rebuild got its own file, maternity `class_id` moved after the referral layer it's independent of, and M05 carries both new `pricing_rule_scope` values) and opens with a "Repo facts you must respect" block — that section is the real insurance, because it pre-empts Lovable from re-deriving the wrong status enums or hunting for `evaluateTriggers()`.

The two corrections most likely to have caused silent runtime failure rather than a loud migration error were #2 (the guard trigger would have compiled fine but never fired, since `collected`/`resulted` can't appear on those tables — the gate would have been decorative) and #6/#9 (wallet posting would have violated the `amount_minor > 0` CHECK on debits, and even when it succeeded, `balance_minor` would have drifted since nothing maintains it automatically). Worth eyeballing those sections in Lovable's build output specifically at the post-build checkpoint.  
-------------------------------------------------

Proceed to build mode.