# RCM R1 — full build (worklists + bulk + HIS wiring), validated & paste-ready

Validated against `velomedos@e4500fa`. **Confirmed present** (no migrations, no new routes): all R1 tables (`visit_eligibility`, `eligibility_exception`, `policy_activation_request`, `payer_agreement`, `not_covered_rule`, `need_approval_rule`, `maternity_protocol`, `contract_change_request`); every route (`eligibility.*` incl `$id.transition`/`$id.exception`/`check`, `policy-activations.*` incl `$id` PATCH + `$id.activate`, `masters/*` full CRUD incl `payer-agreements`/`not-covered-rules`/`need-approval-rules`/ `maternity-protocols` + `contract-change-requests.$id.{approve,apply}`); columns `visit_eligibility.{status, financial_type, result_payload}`, `eligibility_exception.mother_coverage_id`, `policy_activation_request.{policy_no,class_code,membership_no,validity_from,validity_to,notify_reception_at}`. Self-contained: this builds the nav/tab foundation too. Daylight primitives only.

## Canonical facts to code against (do not invent)

- `EligibilityStatus` SSOT = `src/lib/rcm/eligibility-sm.ts`: `new · checking · eligible · not_eligible · error · exception_review · exception_approved · activation_pending · activated · insured · self_pay · cancelled`. Import the type; never hard-code a different list.
- **Transition is EVENT-based** (`eligibility.$id.transition`, body = `EligibilityTransitionRequest`): events are `check.start/success/error`, `exception.raise{referral|emergency|newborn}`, `exception.approve/reject`, `activation.request/complete/reject`, `select.self_pay`, `cancel` — each with `reason?`. You POST an **event** `{kind, reason?}`, not a status.
- `financial_type` = `insurance | self_pay | pending` (default `pending`). "Not yet determined" is `pending`, **not null**.
- `policy_activation_request.status` = `pending | in_progress | activated | rejected`.
- `contract_change_request.status` = `draft | approved | applied | rejected`.
- Masters `$id` PATCH via `_crud.ts` is a **direct update** (no built-in governance) → governed edits go through `contract_change_request` (draft → approve → apply).

## 0 · API client wrappers — `src/lib/clinical-api.ts` (extend; `checkEligibility`/`listEligibility` already exist)

```ts
transitionEligibility:   (id, event: { kind: string; reason?: string; exception_type?: "referral"|"emergency"|"newborn" }) =>
                         clinicalFetch(`/api/clinical/v1/eligibility/${id}/transition`, { method: "POST", body: event }),
raiseEligibilityException:(id, body) => clinicalFetch(`/api/clinical/v1/eligibility/${id}/exception`, { method: "POST", body }),
listPolicyActivations:   (p?: { status?: string }) => clinicalFetch(`/api/clinical/v1/policy-activations${qsInline(p)}`),
patchPolicyActivation:   (id, body) => clinicalFetch(`/api/clinical/v1/policy-activations/${id}`, { method: "PATCH", body }), // assign/reject (status+assignee+reason)
activatePolicy:          (id, body) => clinicalFetch(`/api/clinical/v1/policy-activations/${id}/activate`, { method: "POST", body }),
// masters (thin list/create/update over _crud) — governed edits create a change request instead of PATCH:
listMaster:   (kind) => clinicalFetch(`/api/clinical/v1/masters/${kind}`),
createMaster: (kind, body) => clinicalFetch(`/api/clinical/v1/masters/${kind}`, { method: "POST", body }),
updateMaster: (kind, id, body) => clinicalFetch(`/api/clinical/v1/masters/${kind}/${id}`, { method: "PATCH", body }),
createContractChangeRequest: (body) => clinicalFetch(`/api/clinical/v1/masters/contract-change-requests`, { method: "POST", body }),
approveContractChangeRequest:(id) => clinicalFetch(`/api/clinical/v1/masters/contract-change-requests/${id}/approve`, { method: "POST" }),
applyContractChangeRequest:  (id) => clinicalFetch(`/api/clinical/v1/masters/contract-change-requests/${id}/apply`, { method: "POST" }),

```

Build query strings inline (no shared `qs()` helper exists). No component calls `fetch`.

## 1 · Nav/tab foundation (self-contained)

- `src/components/clinical/daylight/nav-config.ts` (new): `NAV_SECTIONS` = Clinical / RCM / Finance / Admin → `{module,label,tab,icon}`. Tabs: `rcm-eligibility`, `rcm-activation`, `rcm-contracts`, `admin-masters` (+ R2–R7 stub tabs).
- `Shell.tsx`: add those ids to the `TabId` union; render nav from `NAV_SECTIONS` filtered by `canViewModule(role, module)` (drop `disabled` flags); `read_only` sees all + "View only" chip.
- `clinical.tsx`: extend `validateSearch` tab union; render the new panes **in the existing tab switch** (`{tab === "rcm-eligibility" && <EligibilityWorklistPane/>}` …). **No new route files** — `clinical.tsx` is a single tab-switched workspace with no `<Outlet/>`.
- `src/hooks/use-clinical-role.ts` (new): reads `GET /api/clinical/v1/me` (`clinical_role`).
- `src/lib/clinical-role-landing.ts` (**edit existing — do not recreate**): add `approval_officer → rcm-activation`, `rcm → rcm-eligibility`, `claims_officer → rcm-claims`, etc. It already returns `/clinical?tab=…`; landing sets the initial tab.
- `src/lib/clinical/clinical-status.ts` (new): `toneOf(status: EligibilityStatus)` — `insured/eligible/ activated` → teal; `activation_pending/exception_review/exception_approved/checking` → sky/amber; `not_eligible/error` → coral; `self_pay` → muted; `new` → neutral; `cancelled` → muted. Shared across R2–R7. One shared `formatHalalas` (reuse `src/lib/mds/drg-pricing.ts`'s or lift to `src/lib/money.ts`).
- `CapGate.tsx` (new): `<CapGate role cap>` → renders children only if `canPerform(role, cap)`.

## 2 · Eligibility Worklist — `EligibilityWorklistPane.tsx`

- Read `ClinicalAPI.listEligibility()`; **group by real** `EligibilityStatus`: Needs-me-now = `{new, not_eligible, error, exception_review}` · In-flight = `{checking, exception_approved, activation_pending}` · Cleared = `{eligible, insured, activated}` · Settled/Dead = `{self_pay, cancelled}`. Bucket tiles + status chips via `toneOf`.
- **Table columns**: Beneficiary · Coverage · Payer · Policy/Class chips (from payload) · Financial-type lock badge (`insurance`/`self_pay`/`pending`) · Exception chip (referral/emergency/newborn) · last NPHIES reference (from `result_payload`) · Updated.
- **Filters**: bucket · status · financial_type · exception_type · date range · free-text on IDs.
- **Row multi-select + Select-all-in-view + sticky bulk bar** (hidden entirely for `read_only`):
  - *Re-check selected* → per row `checkEligibility({ beneficiary_id, coverage_id, encounter_id })` — **must pass each row's** `coverage_id` (omitting it flips the row to `self_pay`).
  - *Request activation* → `transitionEligibility(id, { kind: "activation.request" })`.
  - *Mark self-pay* → `transitionEligibility(id, { kind: "select.self_pay", reason })`.
  - *Cancel* → `transitionEligibility(id, { kind: "cancel", reason })`.
  - Pattern: `Promise.allSettled(ids.map(runOne))` → toast `N updated / K failed (first: …)` → `refresh()` re-hydrates rows + bucket counts.
- **Drawers**:
  - `ExceptionCaptureDrawer.tsx` → `raiseEligibilityException(id, …)` with three variants: Referral (URL), Emergency (validate CTAS ∈ {1,2}), Newborn (mother coverage picked from `listCoverage`; writes `mother_coverage_id`). Then the SM moves to `exception_review`.
  - `EligibilityDetailDrawer` → pretty-print `result_payload`; render the SM trail; governed override = a typed `reason` that enables a `transitionEligibility` event button (disabled until reason typed).
- Amounts via `formatHalalas` in JetBrains Mono; reuse `PatientBanner` when a row is selected.
- **CapGate**: bulk bar + row actions gated on **existing** `reg.eligibility` (do **not** add `elig.bulk` alias caps to the matrix).

## 3 · Policy Activation Worklist — `PolicyActivationPane.tsx`

- `listPolicyActivations()`; bucket tiles Pending / In-progress / Activated / Rejected.
- Columns: membership_no · policy_no · class_code · validity window · assignee · status.
- Row actions: *Assign to me* → `patchPolicyActivation(id, { assignee_id, status: "in_progress" })`; *Activate* (drawer collects membership_no + validity_from/to + class_code) → `activatePolicy(id, body)` (server stamps `notify_reception_at` → toast "Reception notified"); *Reject* → `patchPolicyActivation(id, { status: "rejected", reason })`. Bulk assign-to-me / activate-with-defaults (only rows whose eligibility already carries payer+policy+class).
- Gate on `reg.activation` (no alias cap).

## 4 · Contracts + Masters editor

- `ContractsPane.tsx`: `contract_change_request` + `payer_agreement` timeline (draft→approved→applied), diff viewer in a modal (before/after JSONB), target_table filter chips, multi-select **bulk Approve / bulk Apply** via `approve`/`apply` endpoints (`Promise.allSettled`). Gate on `contract.change`.
- `ContractMastersPane.tsx` (new, tabbed: Payer agreements · Not-covered · Need-approval · Maternity): **Create** → `createMaster(kind, body)` (direct POST). **Edit existing** → **not** a direct `updateMaster` PATCH; instead `createContractChangeRequest({ target_table, target_id, before, after })` → the governed draft→approve→apply flow performs the update with audit. Gate on `contract.manage` / `contract.change`.

## 5 · HIS linkage (integration)

- `PatientBanner.tsx`: **Eligibility chip** from the most recent `visit_eligibility` for the encounter — derive from real `status` + `financial_type`: `insured/eligible/activated` → green; `activation_pending/ exception_review/checking` → amber; `not_eligible/error` → coral; `financial_type==="self_pay"` → muted. Click → jump to `rcm-eligibility` tab filtered to that row.
- `RegistrationPane.tsx`: after coverage saved, a **"Check eligibility"** button → `checkEligibility({ beneficiary_id, coverage_id, encounter_id })` (**real** `coverage_id`). On `not_eligible`, offer inline "Capture exception" (open drawer) / "Register self-pay" (`transitionEligibility(id, { kind:"select.self_pay", reason })`).
- `EncounterPane.tsx`: read-only ribbon (last eligibility status + financial_type); **disable charge-posting affordances when** `financial_type === "pending"` (not null) — mirrors the server gate, surfaced earlier.

## 6 · Superadmin

- `src/components/superadmin/RcmMastersPane.tsx`: mount `ContractMastersPane` inside the Superadmin shell (tenant selector already there). Register in `SideNav.tsx` under **RCM Masters**, visible to superadmin / tenant_admin only.

## Acceptance (spec §F)

Eligible+active class → row in Cleared, `financial_type=insurance`, green banner chip, no self-pay affordances. · Not-eligible + referral/emergency(CTAS 1–2)/newborn(mother coverage) → exception drawer → `exception_review` → activation row → Activate drawer → `activated` + reception toast. · Not-eligible, no exception → Register self-pay → `self_pay`, muted banner, charges disabled. · Governed override needs typed reason before the event button enables. · Contract change: create draft → bulk-approve → bulk-apply → target updated, audit visible in diff. · Every table: multi-select + select-all-in-view + sticky bar; `read_only` sees no bar.

## DoD

`tsgo` clean; no migrations, no new routes. All R1 endpoints exercised from UI. Bulk on all four tables via `Promise.allSettled` over single-item endpoints. Statuses use the real `EligibilityStatus` union; transition posts events; charges gate on `financial_type==="pending"`. Governed masters edits via `contract_change_request`. Caps use existing matrix entries (no alias caps). One shared `toneOf` + `formatHalalas`. Panes are tabs in `clinical.tsx` (no new route files). Daylight only; halalas in mono; RTL-safe. Superadmin RCM Masters visible to superadmin/tenant_admin only.