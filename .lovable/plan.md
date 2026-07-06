# Step 1 — Turn 3: D5–D9 fixes first, then the deferred surface

Order matters. The predicate and rule seeds ship in Part 1 before any consumer (`gate/preview`, spine components, worklists) lands in Part 2.

## Part 1 — Correctness fixes

### M16 — `charge_is_billed()` cash-scope fix (SQL, function replace only)

Replace only the `_paid_minor` cumulative-cash block inside `public.charge_is_billed()`. Everything else stays byte-for-byte identical (D1 lineage, D2 encounter-class, D3 admission gate, D4 committed-cash sum, exception short-circuit, cancelled guard).

New reducer:

```text
SELECT COALESCE(SUM(net_collected_minor), 0) INTO _paid_minor
  FROM public.cash_collection cc
 WHERE cc.tenant_id = _charge.tenant_id
   AND cc.status = 'posted'
   AND (cc.encounter_id = _charge.encounter_id
     OR cc.claim_id IN (SELECT c.id FROM public.claim c
                         WHERE c.encounter_id = _charge.encounter_id));
```

The `OR beneficiary_id = ...` branch is removed. Voided/refunded collections are already excluded by `status = 'posted'`.

### M17 — Referral rule reseed (data-only)

The five currently-seeded `scope='referral'` rows do not match Addendum 1-A and Rule A is actively harmful (blocks the most common referral path). Delete and reseed:

- `DELETE FROM public.pricing_rule WHERE tenant_id IS NULL AND scope = 'referral';`
- Insert the five rows exactly as specified: Rule A (cross-specialty → `preauth_required + charge_mode='new_consult'`, no block), Rule B (same-specialty ≤14d → `follow_up`, no preauth), Rule C (≥15d lapse → `series_or_no_charge` resolver with `series_specialties: ["physio","rehab","dialysis"]`), Rule D (dental → `approval_before_save + class_limit_check='policy.dental_visits' + recheck_if_bill_after_visit`), Rule E (overbook → `alert_only + hard_cap_key='overbook_limit'`).
- Priorities 10/20/30/40/50; all `active=true`; `ON CONFLICT DO NOTHING`.

### TS fix 1 — `src/lib/rcm/billed-gate.ts` cash scope (mirror of M16)

`BilledGateFacts.cashCollections`: replace `beneficiary_id` with `encounter_id` on the picked columns. The reducer's filter becomes `cc.encounter_id === charge.encounter_id || (cc.claim_id && claimIds.has(cc.claim_id))`. Remove every reference to `f.encounter.beneficiary_id` from the paid computation. Voided rows already excluded by `status === 'posted'`.

### TS fix 2 — multi-admission refund lineage

Add `admissionIdsForEncounter: string[]` to `BilledGateFacts`. In the D1 re-lock check, replace the current single-admission `Set` (built from `f.admission?.id`) with `new Set(f.admissionIdsForEncounter)`. Deposits still match by `encounter_id === charge.encounter_id` OR by `admission_request_id ∈ admissionIdsForEncounter`. `f.admission` remains for the D2 IP/day-case branch (latest is fine there).

### TS fix 3 — `src/lib/mds/rules.ts` trigger folding layer

Leave `evaluateTriggers()` signature untouched. Add and export:

```text
export type TriggerOutcome = {
  preauth_required: boolean;
  charge_mode: "new_consult" | "follow_up" | "series" | "no_charge" | null;
  discount: number | null;
  eligibility_check_required: boolean;
  block_reason: string | null;
};
export function foldTriggerOutcome(hits: TriggerHit[]): TriggerOutcome;
```

Resolution rules:

- Sort hits by `priority` ascending; ties keep input order.
- `preauth_required = OR` across all hits' `action.preauth_required === true`.
- `charge_mode`: first hit whose action carries `charge_mode` (string literal) wins; if only `charge_mode_resolver === 'series_or_no_charge'` is present, resolve to `series` when the caller-supplied fact `target_specialty` ∈ action.series_specialties, else `no_charge`. The resolver requires facts to be passed in — signature stays hit-only, so we read `series_specialties` from the action and defer specialty knowledge to the caller: `foldTriggerOutcome(hits, facts?)` with an optional second arg `{ target_specialty?: string }`.
- `discount`: first hit whose action carries a numeric `discount` wins; else `null`.
- `eligibility_check_required = OR` of `action.eligibility_check_required === true`.
- `block_reason = null` unless a hit carries an explicit `action.block === true` **or** the caller-supplied cap check (Rule E) breaches — Rule E carries `alert_only`, so `block_reason` stays `null` inside the fold; the caller enforces the hard cap. Documented in the JSDoc so callers do not expect the fold to know config values.

### Parity fixtures — `src/lib/rcm/billed-gate.test.ts` (bun test)

Create the file with six fixtures. All use hand-rolled fact objects (no DB). Each fixture asserts `chargeIsBilled(f)` (or `foldTriggerOutcome(hits)`) against the SQL-parity expected outcome.

1. **IMP + drg_bundled, admission gate open** → `{ billed: true, via: 'admission_gate' }`. No auth required (drg_bundled, no per-item preauth flag).
2. **AMB encounter with active day_case admission** → routes through admission gate; gate open, no preauth → `{ billed: true, via: 'admission_gate' }`.
3. **Self-pay: 1 posted payment (100), 3 cash orders (100 each)** — evaluate order #1 → `{ billed: true, via: 'self_pay_cumulative' }`; evaluate order #2 with #1 already `past-gate` → `{ billed: false, reason: 'self_pay_insufficient' }`.
4. **Approved refund on a deposit of the encounter's admission** — deposit's `admission_request_id ∈ admissionIdsForEncounter` → `{ billed: false, reason: 'refund_relock' }`.
5. **D5 regression guard** — cash collection with `encounter_id` ≠ charge's encounter, same beneficiary, `status='posted'` → does NOT count toward `_paid_minor`; a voided collection on the correct encounter is also excluded → `{ billed: false, reason: 'self_pay_insufficient' }`.
6. `**foldTriggerOutcome` cross-specialty** — Rule A hit (`preauth_required:true, charge_mode:'new_consult'`) → outcome `{ preauth_required: true, charge_mode: 'new_consult', discount: null, eligibility_check_required: false, block_reason: null }`.

The test file is the DoD deliverable that keeps SQL/TS drift catchable.

## Part 2 — Deferred surface (unchanged from v1.1)

Ship after Part 1 typechecks and `bun test src/lib/rcm/billed-gate.test.ts` passes.

- `src/lib/rcm/emergency-reconcile.ts` — auth-decision → wallet delta with `sign→direction`, `source='emergency_reconcile'`, atomic `patient_wallet.balance_minor` update. Hooked in `src/routes/api/clinical/v1/auth/requests.$id.decision.ts` and `.../requests.$id.submit.ts`.
- `src/lib/rcm/pbm-engine.ts` — R-PBM2b → 422 `INDICATION_MISSING`; `indication_override` writes an `rcm_gate_exception` row. ADT hook in `src/routes/api/clinical/v1/ip/admission-requests.$id.action.ts`.
- API routes:
  - `api/clinical/v1/gate/preview.ts` (GET; returns `BilledGateOutcome` — the explain-why surface).
  - `api/clinical/v1/gate/exceptions.ts` (POST) + `.$id.reconcile.ts` (POST).
  - `api/clinical/v1/admin-config.ts` (PATCH; superadmin scope).
  - `api/clinical/v1/forms/{defs,instances,bindings}.ts`.
  - `api/clinical/v1/formulary/{import,indications}.ts`.
  - `api/clinical/v1/referrals.ts` (+ `.$id.targets.ts`).
- `_order-factory.ts` PATCH pre-check → 403 `GATE_BILLED` when `charge_is_billed` returns false.
- Spine components under `src/components/clinical/daylight/spine/` (registration, encounter, orders, results tabs; Vitals trend untouched).
- Nav: `daylight/nav-config.ts` — Orders + Results tab enablement flags.
- `src/components/clinical/daylight/RcmAdminPane.tsx` + SideNav registration (both cards visible in superadmin).
- `src/lib/clinical-api.ts` — thin wrappers for the new endpoints.
- `src/lib/clinical-role-matrix.ts` — add `formulary.indications.write` and `forms.instance.cosign` capabilities.

## Definition of Done

- SQL grep: `_paid_minor` sum in `charge_is_billed()` contains no `beneficiary_id =` anywhere.
- TS grep: `billed-gate.ts` has no `beneficiary_id` reference inside the paid reducer.
- Five `scope='referral', tenant_id IS NULL` rows match Addendum 1-A; Rule A carries `preauth_required + charge_mode='new_consult'` and no block action.
- `foldTriggerOutcome` exported from `rules.ts`, returns the five-field contract.
- `src/lib/rcm/billed-gate.test.ts` exists; `bun test` runs it; all six fixtures pass.
- `BilledGateFacts` has `admissionIdsForEncounter: string[]`; D1 re-lock uses it.
- `GET /api/clinical/v1/gate/preview` returns `BilledGateOutcome` (billed flag + via/reason code).
- Part-2 items complete: 403 `GATE_BILLED` on order PATCH, nav tabs enabled, `RcmAdminPane` registered, capabilities `formulary.indications.write` and `forms.instance.cosign` present.

## Technical notes

- SQL edit is a single `CREATE OR REPLACE FUNCTION public.charge_is_billed(...)` in M16; body copy-pasted from the current definition with only the paid-minor reducer rewritten.
- M17 must run inside a migration (data change on a table the code compiles against) so the migration is captured in `supabase/migrations/`.
- The TS type change to `BilledGateFacts.cashCollections` (drop `beneficiary_id`, add `encounter_id`) will ripple to any test doubles or fixture builders — the only current caller is the new test file, so the blast radius is contained.
- `foldTriggerOutcome(hits, facts?)` — the optional facts arg keeps the fold pure; specialty/series resolution stays inside it, config-driven overbook enforcement stays outside.
- Turn-3 Plan — Correction Addendum (append to the plan before build mode)
  Part 1 is approved as written (M16 reducer, M17 reseed, TS fixes 1–3, six fixtures). Part 2 has four corrections that override the corresponding plan lines:
  ## 1. RcmAdminPane location
  `RcmAdminPane.tsx` goes in `src/components/superadmin/`, NOT `src/components/clinical/daylight/`. Register it in `src/components/superadmin/SideNav.tsx`. It contains the two cards (Formulary & Indications, Gate Config Registry), all queries tenant-scoped.
  ## 2. Spine components — exact set
  The spine components are exactly these four primitives under `src/components/clinical/daylight/spine/`:
  - `BilledGate.tsx` — reads `v_order_item_gate`; disables Perform/Dispense with tooltip; badge per RCM color standard (locked=crit, released_by_exception=warn, billed=ok via `.clin-pill`).
  - `FormsGate.tsx` — reads `forms_gate_open()`; composes ABOVE BilledGate (forms gate first).
  - `RcmCommCard.tsx` — two-way RCM channel card (HCA-0188); red state on open reconciliation.
  - `HimCommCard.tsx` — HIM equivalent. Do NOT build registration/encounter/orders/results panes as spine components — Registration and Encounter panes already exist; Orders and Results become enabled nav tabs consuming these primitives.
  ## 3. Role matrix — full capability set (none have landed yet)
  Add ALL of the following to `src/lib/clinical-role-matrix.ts`:
  - `gate.exception.grant` → rcm, tenant_admin
  - `gate.exception.reconcile` → rcm, finance
  - `admin.config.write` → tenant_admin
  - `formulary.import` → tenant_admin
  - `formulary.indications.write` → tenant_admin, pharmacist
  - `forms.def.publish` → tenant_admin
  - `forms.instance.cosign` → physician
  - `referral.write` → physician, front_office, tenant_admin
  - `pbm.override` → rcm
  ## 4. gate/exceptions verbs
  `api/clinical/v1/gate/exceptions.ts`: **GET** (list open exceptions for the RCM worklist, filterable by encounter/state) + **POST** (issue). Add `gate/exceptions.$id.ts`: **PATCH** (close — writes `closed_at`; capability `gate.exception.grant`). Keep `gate/exceptions.$id.reconcile.ts` POST. Without PATCH, exceptions are un-closeable and the emergency-reconcile lifecycle cannot complete.
  ## Wording fix
  `admin-config.ts` is guarded by capability `admin.config.write` (tenant-scoped), not "superadmin scope".
  ## Part 3 (new, small) — demo fixtures for visual verification
  Extend the demo data pack (`demo-seed.functions` / SQL pack) so a fresh reset+seed demonstrates Step 1 when signing in as Tenant Admin:
  - 4–6 orders in `ordered` state across lab/radiology/prescription with charge_items (mix `cash` and `insured`).
  - One approved `authorization_item` on one insured charge (shows a green billed badge).
  - One active `emergency_override` `rcm_gate_exception` on an ER encounter (shows released_by_exception).
  - One posted `cash_collection` covering exactly one cash order (cumulative rule visible: sibling order stays locked).
  - Confirm `rcm_admin_config` demo-tenant rows visible in the Gate Config Registry card. Idempotent, scoped to the demo tenant only, following the existing reset/seed conventions (scoped DELETE, never TRUNCATE).
  ## Added DoD
  - [ ] `RcmAdminPane.tsx` exists under `src/components/superadmin/` and appears in superadmin SideNav.
  - [ ] `spine/` contains exactly the four primitives; no duplicate registration/encounter panes.
  - [ ] All nine capabilities present in the role matrix.
  - [ ] Exceptions can be listed (GET), issued (POST), closed (PATCH), reconciled (POST reconcile).
  - [ ] After demo reset+seed: Tenant Admin sees Orders + Results tabs with gate badges in all three states, and the Gate Config Registry shows the demo tenant's config.