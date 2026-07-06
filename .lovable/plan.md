# Part 0 — Step‑1 Carryover

Six close-out items on top of the Step‑1 surface. Ship exactly what's listed; no drift into Step 2.

## 0.1 · OrdersPane: real gate state from `v_order_item_gate`

`src/components/clinical/daylight/OrdersPane.tsx`

- Delete `deriveOutcome()`.
- After `ClinicalAPI.listCharges(encounterId)`, call the new `ClinicalAPI.gate.viewByEncounter(encounterId)` wrapper (a thin `SELECT charge_item_id, gate_state, reason_code, exception_id, pricing_mode FROM v_order_item_gate WHERE encounter_id=?` exposed as `/api/clinical/v1/gate/view?encounter_id=...`, or an existing `gate/preview` batch call). Keep it a single round trip.
- Build a `Map<charge_item_id, GateRow>`; for each `ChargeRow` compute `outcome` from the server row:
  - `gate_state = 'billed'` → `{ billed:true, via: pricing_mode === 'insured' ? 'insured_auth' : 'self_pay_cumulative' }`
  - `gate_state = 'released_by_exception'` → `{ billed:true, via:'release' }` (amber)
  - `gate_state = 'locked'` (or row missing) → `{ billed:false, reason: reason_code ?? 'unknown' }` — tooltip surfaces `reason_code`.
- Status filter dropdown values corrected to real `charge_status` literals: `ordered`, `collected`, `in_progress`, `resulted`, `dispensed`, `cancelled` (drop `pending`; add `ordered`).
- Convention comment at the top: "Worklists join `v_order_item_gate`; never derive gate state client-side."

Server side: add `src/routes/api/clinical/v1/gate/view.ts` returning
`{ data: Row[] }` for the encounter (or extend the existing
`gate/preview.ts` to accept `?encounter_id=` and return the same shape).
Uses `serviceClient` + `requireTenant`.

## 0.2 · Register `RcmAdminPane` in superadmin `SideNav`

`src/components/superadmin/SideNav.tsx` already declares
`SuperTabId = "…" | "rcm_admin"` but has no visible entry. Add a new
`groups` entry:

```
{ id: "rcm", label: "RCM", items: [
  { id: "rcm_admin", label: "RCM admin", icon: Settings },
]},
```

The tab is already routed in `superadmin.tsx` (`tab === "rcm_admin"` renders
`<RcmAdminPane />`). No other wiring needed.

## 0.3 · PBM wiring on prescription POST + PATCH

`src/routes/api/clinical/v1/_order-factory.ts`

Extend both factories with an optional per-item hook so only prescriptions
opt in:

```
type ItemHooks = {
  preCreate?: (ctx, item) => Promise<Response | void>;
  prePatch?:  (ctx, id, patch) => Promise<Response | void>;
};
```

- `orderRouteHandlers` runs `hooks.preCreate` before each `itemsIns` insert.
- `orderItemHandlers` runs `hooks.prePatch` at the top of PATCH.

`src/routes/api/clinical/v1/encounters.$id.prescriptions.ts` and
`.../orders/prescription-items.$id.ts` pass `hooks` that call
`validatePrescriptionItem` (`src/lib/rcm/pbm-engine.ts`):

- Input carries `tenantId`, `drugId`, `indicationIcd10` (from
`it.indication_icd10`), `override = it.indication_override === true`,
`encounterId`, `chargeItemId` (only present on PATCH), `actorId`.
- On result `{ ok:false, code:"INDICATION_MISSING" }` → return
`envelope("PBM indication missing", "INDICATION_MISSING", 422)`.
- On override, engine already writes the `rcm_gate_exception`
(`indication_override` / `pbm_indication_missing`); the hook just returns
`void` and lets the write proceed. Override path gated by the
`pbm.override` capability via `requireClinicalModule(..., { capId: "pbm.override" })` when `it.indication_override === true`.

Zod: extend `PrescriptionItemCreate`/`PrescriptionItemUpdate` in
`src/lib/mds/schema/orders.ts` with optional `indication_icd10?: string`
and `indication_override?: boolean` (both nullable).

ADT hooks in `.../ip/admission-requests.$id.action.ts` (§3.3a–d):
after an `admit`/`transfer`/`discharge`/`no-show` action, call
`encounter_advance_journey(encounter_id, target_state)` and, on
`discharge`, enqueue any open `emergency_override` exceptions on the
encounter through `reconcileEmergencyException` (best-effort, audit on
failure — same swallow pattern as decision.ts/submit.ts).

## 0.4 · Test fixtures

Add `src/lib/rcm/emergency-reconcile.test.ts` (bun test, mocked supabase
via a tiny `createFake()` helper — no network):

- `+delta → credit`: manual=100, nphies=150 → `direction:"credit"`,
`amount:50`, `wallet_apply_txn` called once with `_delta_minor: 50`.
- `−delta → debit`: manual=150, nphies=100 → `direction:"debit"`,
`_delta_minor: -50`, one RPC call.
- Idempotency: second call on the same exception returns
`{ ok:true, already:true }`; RPC not called.
- Zero delta: no `wallet_txn` insert, exception still stamped
`reconciled_at`.

Extend `src/lib/rcm/billed-gate.test.ts` with one PBM fold fixture:
`foldTriggerOutcome` with `preauth_required=true` + `substitute_with`
merges to `{ preauth_required:true, substitutions:["…"] }`.

## 0.5 · Demo fixtures migration

New migration `demo_gate_fixtures`:

- Scoped to the demo tenant (looked up by
`corporate_accounts.slug = 'connect-care'`); all inserts use
`ON CONFLICT DO NOTHING`.
- Three encounters + charges + supporting rows:
  - **Green** — insured `AMB` encounter, one `service_order_item` +
  `charge_item(pricing_mode='insured', status='ordered')`, with an
  approved `authorization_item` for that charge (billed via
  `insured_auth`).
  - **Amber** — `EMER` encounter, one insured `charge_item`, one open
  `rcm_gate_exception` (`exception_type='emergency_override'`,
  `reason_code='ctas_1_2'`, `closed_at IS NULL`,
  `reconciled_at IS NULL`, `manual_approved_minor=…`).
  - **Red** — `AMB` cash encounter with two `charge_item(pricing_mode ='cash')` rows A and B, one `cash_collection(status='posted')`
  covering A only. B renders red with `reason_code='cash_shortfall'`.

Acceptance: `demo reset` → `demo seed` → sign in as Tenant Admin →
`/clinical?tab=orders` shows the three colors on the three encounters.

## 0.6 · `clinical-api.ts` typed wrappers

Add under a new `gate`, `adminConfig`, `forms`, `formulary`, `referrals`
namespaces on `ClinicalAPI`:

- `gate.preview({ items })` → POST `/gate/preview`
- `gate.view({ encounter_id })` → GET `/gate/view?encounter_id=…` (new; §0.1)
- `gate.exceptions.list({ encounter_id })` → GET `/gate/exceptions`
- `gate.exceptions.create(body)` → POST `/gate/exceptions`
- `gate.exceptions.patch(id, body)` → PATCH `/gate/exceptions/{id}`
- `gate.exceptions.reconcile(id, { nphies_approved_minor })` → POST `/gate/exceptions/{id}/reconcile`
- `adminConfig.get(key)` / `adminConfig.set(key, value)` → GET/PATCH `/admin-config`
- `forms.defs.{list,get,upsert}` / `forms.instances.{list,create,submit}` / `forms.bindings.{list,upsert}`
- `formulary.import(body)` / `formulary.indications.{list,create,patch,delete}`
- `referrals.{list,create,patch}` + `referrals.targets(id)`

Each wrapper is a two-liner using existing `clinicalFetch` + `qs` helpers;
`listEncounters`/`listCharges` remain unchanged.

## Verification (Part-0 DoD)

- `bunx tsgo` clean.
- `bun test src/lib/rcm/*.test.ts` green including the new reconcile + PBM
fixtures.
- Preview: `/superadmin` → RCM group visible → RCM admin loads
`RcmAdminPane`.
- Preview: reset → seed → Tenant Admin → `/clinical?tab=orders` renders
green / amber / red rows across the three demo encounters; amber row's
tooltip reads "Released by exception (release)".
- Grep: `deriveOutcome` gone from the codebase; `pending` gone from the
Orders status dropdown; `SideNav.tsx` references `rcm_admin`.

## Technical notes

- `v_order_item_gate` is the canonical source; `gate_state` is a
Postgres enum (`billed | released_by_exception | locked`).
- The factory hook stays additive — non-prescription modalities pass no
`hooks`, keeping the current behavior byte-identical.
- `pbm-engine.ts` already writes the `rcm_gate_exception` on override; the
server-fn cap check gates *who* can send `indication_override:true`.
- No schema changes required beyond the demo-fixtures migration.
- Approved with five amendments: (1) skip §0.2 entirely — the RCM group and rcm_admin entry already exist in SideNav (lines ~106-108) and superadmin.tsx already renders the pane; adding your proposed group would duplicate it — verify visually only. (2) §0.3: no `indication_icd10` on prescription_item and none added — `validatePrescriptionItem` takes `{ tenantId, drugId, encounterId, override, actorId }` and matches the generic's `drug_indication_map` rows against the encounter's `encounter_diagnosis` ICD-10 codes; empty intersection → 422. Zod adds only `indication_override?: boolean`. (3) §0.3 ADT hooks: drop `encounter_advance_journey`; on daily-fill/LOS actions re-run PBM validation over active prescription items as audit warnings (never block existing therapy), on discharge validate discharge meds + best-effort reconcile open emergency_override exceptions. (4) §0.4: the fold fixture asserts the five-field TriggerOutcome contract only — no `substitutions` field; test substitutions in pbm-engine's own result. (5) §0.5: red row B expects `gate_state='locked'` with NULL reason_code — `cash_shortfall` is not an enum value; do not seed an exception for it. Everything else as planned.