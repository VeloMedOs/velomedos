# RCM R5 verdict + R6 (Deposits / Refunds / Wallet) — validated, paste-ready

Validated against `velomedos@a07f876`.

---

## PART A — R5 `batch-sm.ts`: CORRECTLY FORMED, no amendment

Pure TS state machine (`open → submitting → submitted → closed`, `cancelled` from `open`), no DB/API surface to mismatch. Transitions + guards are coherent. Nothing to fix. (Confirm the R5 migration landed the `claim_status_check` drop/re-add for `paid`/`part_paid`/`denied` per the prior amendment — R6's settlement depends on it.)

---

## PART B — R6 Deposits / Refunds / Wallet — corrected

R6 ships a migration + new routes. **Confirmed present:** the `deposit` table (with `amount_minor`, `applied_to_bill_id`, `received_by`, `requested_minor`), `deposit_recalc_admission_paid()` (extendable), `requireClinicalModule("Deposits & Refunds")`, and the module's existing caps `dep.collect`/`dep.approve`. Seven corrections; the first is a migration-breaker.

### [FIX 1 — CRITICAL: `deposit_status` is an ENUM → ADD VALUE hazard]

`deposit_status` is a Postgres **enum** (current values incl. `collected`, `pending`, `applied`, `refunded`). Adding `held`/`partially_applied`/`transferred` via `ALTER TYPE … ADD VALUE` **and** using them in the **same migration's** `deposit_txn_apply` trigger will throw *"unsafe use of new value"* (the R1 lesson). **Split into two migrations:** (1) `ALTER TYPE deposit_status ADD VALUE IF NOT EXISTS …` for the three new values only; (2) the tables + triggers that reference them. `refunded` already exists — don't re-add. `deposit_type` (`general|encounter|…|caution`) is a **new** `CREATE TYPE` — safe same-txn.

### [FIX 2 — invented roles] `rcm`/`finance`, not "RCM Manager"/"Finance Manager"

`rcm_manager`/`finance_manager` don't exist. Map the manager-level caps to the real roles: `rcm` + `finance` for `deposit.override_caution` / `refund.approve`; `cashier`/`biller` for collect/apply/request; `cashier` (cash) + `finance` (bank/card) for `refund.execute`.

### [FIX 3 — caps: add to the matrix SSOT, keep the `dep.`/`refund.` convention]

Only `dep.collect` + `dep.approve` exist. Add the granular caps to `src/lib/clinical-role-matrix.ts` (the `CLINICAL_CAPABILITIES` SSOT — **not** `clinical-roles.ts`) under the existing **"Deposits & Refunds"** module, following the naming already in use: `dep.apply`, `dep.transfer`, `dep.override_caution`, `refund.request`, `refund.approve`, `refund.execute`, `credit_note.issue`, `erp.repost`. Gate routes/UI via `canPerform`/`CapGate` on these.

### [FIX 4 — no `bill` table: deposits settle against `claim`]

`deposit.applied_to_bill_id` is an **unconstrained UUID** and there is **no** `bill`**/**`invoice`**/**`charge` **settlement table** — the billable unit is the `claim` (R3) plus its `charge_item` lines. So the apply-to-bill wizard and `<AvailableDepositBanner>` must target the **claim** (set `applied_to_bill_id = claim.id`; reduce `available_minor`; reflect on the claim's patient-share). Same reconciliation R5's remittance posting needed — bind both to the real settlement entity.

### [FIX 5 — panes live in `daylight/`, not a new `rcm/` dir]

`src/components/clinical/rcm/` doesn't exist; all panes are in `src/components/clinical/daylight/` (alongside `ClaimsWorklistPane`, `IpAdmissionsPane`). Put the six R6 panes there. Wire them into `clinical.tsx` as tabs under a "Deposits & Wallet" node (add `TabId`s + `validateSearch`).

### [FIX 6 — banner embed targets] no R3 `BillingPane`

There is no `BillingPane`. Embed `<AvailableDepositBanner beneficiaryId encounterId />` in the **R4** `IpAdmissionsPane`**/admission drawer** (exists) and the **OP claims/billing surface** that actually renders (`ClaimsWorklistPane` / the `finance-billing-op` tab) — not a nonexistent `BillingPane`. Defer any embed whose host pane isn't built yet.

### [FIX 7 — don't re-add existing `deposit` columns]

`amount_minor`, `applied_to_bill_id`, `received_by`, `requested_minor` already exist. Add only the new columns (`deposit_no`, `deposit_type`, `scope_ref_id`, `is_caution`, `available_minor`, `pos_reference`, `collected_by`, `erp_posting_ref`, `erp_posted_at`) with `IF NOT EXISTS`.

### Confirmed-good — keep (integration)

- `requireClinicalModule("Deposits & Refunds", <cap>)` guard; **extend** the existing `deposit_recalc_admission_paid()` for the new statuses (function exists).
- New tables `deposit_transaction` (immutable ledger) / `deposit_attachment` / `refund_request` (+attach) / `patient_wallet` / `wallet_txn` / `credit_note` / `erp_posting_queue` — own CREATE→GRANT→RLS→POLICY.
- `deposit-sm.ts` / `refund-sm.ts` pure SMs; new blockers `CAUTION_CANNOT_SETTLE`, `REFUND_METHOD_MISMATCH`, `REFUND_HOLD_OUTSTANDING`, `REFUND_REASON_REQUIRED`, `DEPOSIT_ERP_UNPOSTED` in `src/lib/rcm/validation.ts`.
- Caution guard (`deposit_apply_guard` blocks settle unless `OVERRIDE:` reason + approver); refund-method matrix (`refund_method_guard`); `credit_note_apply` → `wallet_txn` credit; every txn enqueues `erp_posting_queue` (contract only — R7 builds the connector).
- **Linkage:** R4 admission paid via the extended recalc; R3 claim settlement (FIX 4); credit note from a non-performed billed service → wallet (R3 charge linkage); bulk endpoints return `{ results:[{id,ok,error?}] }`; shared `toneOf*`/`formatHalalas`/`CapGate`; halalas in mono.

### DoD

**Migration 1:** `deposit_status` ADD VALUE (`held`/`partially_applied`/`transferred`, IF NOT EXISTS) only. **Migration 2:** `deposit_type` CREATE TYPE + additive `deposit` columns (IF NOT EXISTS, not the four that exist) + new tables (CREATE→GRANT→RLS→POLICY) + triggers (referencing the now-committed enum values) + extended `deposit_recalc_admission_paid`. Caps added to `clinical-role-matrix.ts` with real roles. Apply/ banner target `claim`. Panes in `daylight/`, tabs in `clinical.tsx`. New blockers in `validation.ts`; bulk per-row. `tsgo` green; Daylight only; halalas in mono; RTL-safe; no invented roles.