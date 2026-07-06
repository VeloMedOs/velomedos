## Step 1 · Turn 4 — Part 2 (Deferred Surface) + Correction Addendum v2

Ships the deferred RCM/Clinical spine surface on top of corrected Part 1 (M16/M17, `foldTriggerOutcome`, parity tests). Addendum v2 overrides the base plan where stated below; everything else in the base plan stands.

---

### 1. Server engines & helpers

- `src/lib/rcm/emergency-reconcile.ts` — **effectful loop** (overrides base plan's pure diagnoser). Signature: `reconcileEmergencyException(supabase, { exceptionId, nphiesApprovedMinor })`. Must:
  1. Compute `wallet_delta_minor = nphies_approved_minor − manual_approved_minor`.
  2. Insert `wallet_txn` (`direction = delta > 0 ? 'credit' : 'debit'`, `amount_minor = abs(delta)`, `source='emergency_reconcile'`, `related_exception_id`).
  3. Update `patient_wallet.balance_minor` in same transaction.
  4. Set `rcm_gate_exception.reconciled_at`, `nphies_approved_minor`, `wallet_delta_minor`.
  Hook sites (automatic): `auth/requests.$id.decision.ts` and `auth/requests.$id.submit.ts` — after decision write, if encounter holds an active `emergency_override` exception, invoke reconciler. Manual endpoint `gate/exceptions.$id.reconcile.ts` calls the same function. Internal pure delta helper allowed.
- `src/lib/rcm/pbm-engine.ts` — evaluates PBM trigger hits from `evaluateTriggers(..., "pbm")`; returns `{ formulary_ok, substitutions[], preauth_required, block_reason }`. Wired via `validatePrescriptionItem()` called from prescription-item POST/PATCH (factory + `orders/prescription-items.$id.ts`):
  - R-PBM2b miss → **422** `{ code: 'INDICATION_MISSING' }`.
  - Override path: `indication_override: true` (cap `pbm.override`) writes `rcm_gate_exception` (`exception_type='indication_override'`, `reason_code='pbm_indication_missing'`) and allows save. PBM never blocks the billed gate.
  - ADT hooks in `ip/admission-requests.$id.action.ts`: admission-med reconciliation, IP daily fill re-price, LOS-extension bundle, discharge meds (§3.3a–d).

### 2. API routes (all `/api/clinical/v1/`)

Standard envelope `{ error, code, request_id }`, `requireClinicalWrite/Read` with explicit `capId`, no raw DB error leaks.

Base plan routes (unchanged):

- `gate/preview.ts` — GET `?charge_id=...`. Returns TS `BilledGateOutcome` + fact snapshot. Cap `gate.preview`.
- `gate/exceptions.ts` — GET list (filters `status`, `encounter_id`) + POST create. Caps `gate.exception.read` / `gate.exception.create`.
- `gate/exceptions.$id.ts` — PATCH. Cap `gate.exception.update`.
- `gate/exceptions.$id.reconcile.ts` — POST. Cap `gate.exception.reconcile`; delegates to `reconcileEmergencyException`.
- `admin-config.ts` — GET + PATCH (writes history row). PATCH cap `admin.config.write`.
- `_order-factory.ts` — server pre-check on advance-to-perform: `chargeIsBilled(...)` false and no active releasing exception → 403 `{ code: "GATE_BILLED" }`.

Addendum-restored route groups:

- `forms/defs.ts` (GET/POST), `forms/defs.$id.ts` (PATCH publish/version, cap `forms.def.publish`).
- `forms/instances.ts` (GET/POST), `forms/instances.$id.ts` (PATCH answers/status/cosign; cosign transition requires `forms.instance.cosign`).
- `forms/bindings.ts` (GET/POST/PATCH, cap `forms.def.publish`).
- `formulary/import.ts` (POST — CHI UDF Excel staged diff → publish, cap `formulary.import`).
- `formulary/indications.ts` (GET/POST) + `formulary/indications.$id.ts` (PATCH/DELETE, cap `formulary.indications.write`).
- `referrals.ts` (GET/POST, POST cap `referral.write`) + `referrals.$id.targets.ts` (GET/POST).

### 3. Spine primitives (exactly four)

Under `src/components/clinical/daylight/spine/`:

- `BilledGate.tsx` — wraps an action; three badge states: `billed` (green), `released_by_exception` (amber), `locked` (red). Tooltip carries `reason`/`via`.
- `FormsGate.tsx` — mirrors `forms_gate_open()`; disables action while any mandatory pre-form is unsubmitted.
- `RcmCommCard.tsx` — thread renderer over `authorization_communication` + `denial_communication`.
- `HimCommCard.tsx` — coding/HIM thread over `clinical_audit` + `clinical_coding` notes.

### 4. Nav — do the required work, drop the invented tabs (overrides base plan §4)

- `nav-config.ts`: flip **Orders** and **Results** items to `disabled: false` (the Step-1 DoD item). Vitals trend stays disabled.
- **Do NOT** create `rcm-gate`, `rcm-exceptions`, or `rcm-admin` clinical tabs. Exceptions worklist UI is Step 2; its API ships now. RCM admin lives only in superadmin.
- Orders/Results tab bodies render rows wrapped in `<BilledGate>` — that IS the visible gate surface this turn.

### 5. RcmAdminPane — two cards (overrides base plan §4)

`src/components/superadmin/RcmAdminPane.tsx`, registered in `src/components/superadmin/SideNav.tsx` under RCM group. Contains:

1. **Gate Config Registry** — deposit %, overbook limit, dispensing windows, indication default; history side panel from `rcm_admin_config_history`.
2. **Formulary & Indications** — CHI UDF Excel import (staged diff → publish via `formulary/import`), `drug_indication_map` browser/editor, per-generic block/warn severity.

### 6. Capability matrix — merged final set (15 rows)

Append to `src/lib/clinical-role-matrix.ts`:

```
gate.preview              → all clinical roles + rcm, biller, cashier, tenant_admin
gate.exception.read       → rcm, biller, cashier, case_manager, tenant_admin
gate.exception.create     → rcm, tenant_admin           (locked)
gate.exception.update     → rcm, tenant_admin
gate.exception.reconcile  → rcm, finance, tenant_admin
admin.config.write        → tenant_admin
rcm.comm.read             → rcm, biller, cashier, physician, nurse, case_manager, tenant_admin
rcm.comm.write            → rcm, biller, case_manager, tenant_admin
him.comm.write            → coder, physician, tenant_admin
formulary.import          → tenant_admin
formulary.indications.write → tenant_admin, pharmacist
forms.def.publish         → tenant_admin
forms.instance.cosign     → physician
referral.write            → physician, front_office, tenant_admin
pbm.override              → rcm
```

### 7. Client wrappers (`src/lib/clinical-api.ts`)

Typed wrappers for each new endpoint: `gatePreview`, `listGateExceptions`, `createGateException`, `updateGateException`, `reconcileGateException`, `getAdminConfig`, `patchAdminConfig`, plus forms/formulary/referrals wrappers.

### 8. Demo fixtures — correct state mapping (overrides base plan §7)

New migration seeding demo tenant. Landing: `/clinical?tab=orders` (not an invented tab).

- **Green (billed)** — insured AMB order with approved `authorization_item`. Optional second green: IMP encounter with `admission_request.request_type = 'medical'` (corrected enum), auth approved, deposit ≥ configured %.
- **Amber (released_by_exception)** — ER (`EMER`) encounter order with ACTIVE `emergency_override` `rcm_gate_exception` (`reason_code='ctas_1_2'`, `manual_approved_minor` set, unreconciled).
- **Red (locked)** — cash AMB encounter with one posted `cash_collection` covering only order A; orders B/C show locked (cumulative rule). Optional second red: `deposit.encounter_id = encounter` with approved `refund_request` → `refund_relock` (never route AMB refund through an admission).
- Gate Config Registry card shows demo tenant's seeded `rcm_admin_config` rows.
- All seeds scoped to demo tenant via `corporate_accounts.is_demo = true`; `ON CONFLICT DO NOTHING`; scoped DELETE.

### 9. Verification

- Extend `src/lib/rcm/billed-gate.test.ts` with an emergency-reconcile fixture (both delta signs) and a PBM fold fixture.
- `bun test` — all green.
- Manual: reset demo → Tenant Admin → `/clinical?tab=orders` shows green/amber/red badges.
- `curl` `_order-factory` PATCH on unbilled charge → 403 `GATE_BILLED`.
- Grep: no `beneficiary_id` in paid reducer; nav-config `disabled:false` only for wired panes.

---

### **one line to append before build mode:**

> Idempotency guard on the reconcile hook: `reconcileEmergencyException` must no-op when `rcm_gate_exception.reconciled_at` is already set. Both `decision.ts` and `submit.ts` can fire for the same authorization round-trip, and without the guard the wallet_txn posts twice and `balance_minor` drifts by the delta amount.

That's a real money-corruption path, not pedantry: a double-posted 2,000-SAR debit against a patient wallet is exactly the kind of bug that surfaces weeks later as an unexplainable balance during cash reconciliation. The `reconciled_at IS NULL` check makes the loop safely re-entrant, and the manual endpoint should return a 409 or a friendly "already reconciled" rather than re-posting.

Send it with that line, then "Turn 4 built" when done. The post-build verification will be the heaviest yet (~20 files), prioritized as: (1) the reconcile hook firing once and only once per exception with correct signs and balance movement, (2) the prescription 422/override leaving a real exception row, (3) the 403 `GATE_BILLED` on the order factory, (4) grep for invented tabs and duplicate panes, (5) the demo walk-through — after which you can finally do the visual check yourself in the demo environment and see Step 1 working end to end. Green from all five closes Step 1 and unlocks Step 2's Clinical Spine shells.  
  
Definition of Done (base + Addendum v2)

- Four spine primitives exist under `daylight/spine/`; no extras.
- 15 capability rows present in `clinical-role-matrix.ts`; `gate.exception.create` restricted to rcm/tenant_admin.
- `gate/preview` returns TS `BilledGateOutcome`.
- `gate/exceptions` supports GET+POST; `$id` PATCH; `$id/reconcile` POST.
- `admin-config` PATCH gated by `admin.config.write`.
- `_order-factory` returns 403 `GATE_BILLED` on direct hit.
- `RcmAdminPane` registered in superadmin `SideNav`, shows **both** cards.
- Orders + Results nav items enabled; **no** new clinical tabs.
- All six restored route groups exist with their caps (forms ×3, formulary ×2, referrals ×2 files).
- Auth decision on an emergency-override encounter automatically posts `wallet_txn`, updates balance, sets `reconciled_at` — verified for both delta signs.
- Prescription POST without matching indication → 422 `INDICATION_MISSING`; with `pbm.override` cap → saved + exception row.
- Demo amber = `emergency_override` exception (not a payment scenario); fixture uses `request_type='medical'` for the IMP green case.
- `bun test` green; no cross-encounter `beneficiary_id` regression.
## Step 1 · Turn 5 · Close-out (shipped)
- B1 · Reconcile hook wired into auth decision + submit routes; failures logged to clinical audit, do not fail the decision write.
- B3 · BilledGate / FormsGate / RcmCommCard / HimCommCard use `.clin-pill.{ok,warn,crit,info}` and `.clin-card` — no raw palette classes under `daylight/spine/`.
- B4 · Migration adds `public.wallet_apply_txn(uuid, bigint) → bigint` (SECURITY DEFINER, service_role only). `emergency-reconcile.ts` now uses the RPC — no client-side balance RMW.
- Superadmin SideNav registers RcmAdminPane under new `rcm` group (`rcm_admin` tab), rendered in superadmin route.
- Real OrdersPane + ResultsPane replace VitalsTrendPane on tabs `orders` / `results`; each row wraps its action in `<BilledGate>` and includes an `<RcmCommCard>` right-rail.
- Deferred to Step 2: `validatePrescriptionItem` wiring, ADT action hooks, extended billed-gate tests (reconcile ± / idempotency, PBM fold), Part-3 demo fixtures migration, full `clinical-api.ts` wrappers for the gate/admin-config/forms/formulary/referrals surface.
