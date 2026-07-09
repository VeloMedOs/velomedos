# Step 4 · Turn 2 — E14 Cashier UI + E15 Routing Board + Wallet Gate (corrected v2, repo-verified @988b3c1)

Closes debt #29 (E14 cashier), #30 (E15 board), #37 (wallet-negative OPD order gate). Non-goals unchanged (#31–#36, #38–#40 → Turns 3–5).

## Repo facts verified at plan-time (OVERRIDES v1 plan — do not re-derive)

- **No** `bill`**/**`bill_item` **tables** (v1 plan already acknowledges). Chain: `charge_item → claim/claim_item`; money via `deposit/deposit_transaction`, `patient_wallet/wallet_txn`, `credit_note`, `cash_collection/cash_session`, `tax_invoice/tax_invoice_line`.
- `charge_item.billing_type` **does NOT exist** (KK1). It is a catalog attribute → additive `service_master.billing_type` this turn.
- `wallet_apply_txn(_wallet_id uuid, _delta_minor bigint) RETURNS bigint` — sole balance write path. Routes resolve wallet id, insert `wallet_txn` (with valid `source`), call the RPC. Never `UPDATE patient_wallet SET balance_minor`.
- `wallet_txn.source` **has a CHECK** (extended in M06). Plan-time psql: `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='wallet_txn_source_check';` — if `'credit_note'` absent, extend CHECK in its own migration first (R1 pattern).
- `'expired'` **is an** `authorization_request.status` **value;** `authorization_item.decision ∈ (pending,approved,partial,rejected)` (KK3). "Raise pre-auth" trigger reads the request header via item→request join.
- `deposit_txn_apply_ai` AFTER INSERT trigger on `deposit_transaction` exists — allocate route inserts the row; the trigger recomputes deposit balance + ERP enqueue.
- `encounter_open` **is the journey state at visit creation** — too early for the consultation-fee lock (KK2). Lock signal: linked `clinic_bookings.status='in_consult'` (primary) or `journey_state='clinically_documented'` (fallback).
- File 17 §4 confirmed: negative wallet blocks the next OPD **order** — `_order-factory.ts` is the correct enforcement point.
- `claim.status` CHECK exists — plan-time psql to list values; "open" filter uses the actual non-terminal values, not a guessed literal.

## 1 · DB migrations (additive, strict order)

**M-S4T2-00 ·** `service_master.billing_type` (KK1 — must precede the charges route)

```sql
ALTER TABLE public.service_master
  ADD COLUMN IF NOT EXISTS billing_type text NOT NULL DEFAULT 'on_raising'
  CHECK (billing_type IN ('on_raising','on_execution','no_charge'));

```

**M-S4T2-00b ·** `wallet_txn` **source CHECK extension** — ONLY if plan-time psql shows `'credit_note'` missing; own migration.

**M-S4T2-01 ·** `v_cashier_worklist` — as v1 plan, plus `sm.billing_type` through the service join. SECURITY INVOKER; tenant scoping via underlying RLS. "Open claims" filter uses verified `claim.status` values.

**M-S4T2-02 ·** `wallet_gate_open(_beneficiary_id uuid, _tenant_id uuid) RETURNS boolean` — STABLE SECURITY DEFINER, `SET search_path=public`; true iff wallet missing OR `balance_minor >= 0`. REVOKE from anon; GRANT to authenticated + service_role.

**M-S4T2-03 · occupancy refresh triggers —** `FOR EACH STATEMENT` (KK5)

```sql
CREATE TRIGGER clinic_bookings_occupancy_refresh
  AFTER INSERT OR UPDATE OF status ON public.clinic_bookings
  FOR EACH STATEMENT EXECUTE FUNCTION public.tg_refresh_queue_occupancy();
-- same statement-level trigger on encounter (status changes)

```

`tg_refresh_queue_occupancy()` derives affected tenant(s) and calls `refresh_queue_occupancy`. Statement-level so bulk-cancel (debt #38) recomputes once, not N times.

## 2 · Server routes (`src/routes/api/clinical/v1/opd/`) — pure handlers, capIds, envelope

New capIds: `opd.cashier.read` (front_office, tenant_admin), `opd.cashier.write` (front_office, tenant_admin), `opd.routing.read` (front_office, floor_manager, tenant_admin), `opd.orders.wallet_gate` (physician, nurse, front_office, tenant_admin).

- `opd.cashier.worklist.ts` GET — `v_cashier_worklist`, caller-scoped (HCA-0948). RLS + explicit `user_id = ctx.userId` unless caller has tenant_admin.
- `opd.cashier.charges.ts` GET `?encounter_id` — line items: `charge_item` × `authorization_item` (latest decision) × request header (for `expired`) × `service_master.billing_type`. Returns `approved_amount_minor` (= `authorization_item.benefit_amount_minor`), `copay_minor`, `auth_status` (**item decision, plus** `request_status` **separately** — KK3), `billing_type`. HCA-0793/0209/1062.
- `opd.cashier.allocate.ts` POST — per allocation: `deposit` → insert `deposit_transaction` (trigger `deposit_txn_apply_ai` settles); `cash` → insert `cash_collection` (encounter-scoped); `wallet` → resolve `patient_wallet.id`, insert `wallet_txn` (valid source), call `wallet_apply_txn(wallet_id, -amount_minor)`. Returns per-row gate state from `v_order_item_gate` post-write. Never mutates balances directly.
- `opd.cashier.raise-preauth.ts` POST — creates `authorization_request` linked to the charge; enabled when **request** status is `expired` or absent (KK3).
- `opd.cashier.credit-note.ts` POST `{encounter_id, charge_item_ids[], reason}` — server-side guards (KK6), in order:
  1. **Unperformed-only**: resolve each charge's order item via `charge_item.order_item_table/order_item_id`; reject with 422 `item_already_performed` if status has left `ordered` (or `prescription_item.dispense_status='dispensed'`).
  2. **Consultation-fee guard**: if the charge is the consultation fee and `consultation-lock` says locked → 409 `consultation_locked` (HCA-0802).
  3. Create `credit_note` rows (mandatory `reason`); co-pay already collected → wallet credit via `wallet_txn` + `wallet_apply_txn(wallet_id, +copay_minor)`.
  4. **Authorization revocation**: linked `authorization_request` for a fully-cancelled item → status `cancelled` (or the enum's revocation value — verify at build).
  5. **VAT/ZATCA**: if a `tax_invoice` already covers the charge, route through the existing vat-engine credit path; if OP invoices are cut at claim assembly only (expected), add code comment + **debt row #41: ZATCA credit-note linkage for pre-invoice cancellations**. Cancelled items excluded from invoice preview.
- `opd.cashier.consultation-lock.ts` GET — `{locked, reason}` where locked ⇔ linked booking `status='in_consult'` OR `encounter.journey_state='clinically_documented'` (KK2). Unlock only via doctor revert (booking back to `arrived` / consultation order cancelled).
- `opd.cashier.eligibility-freshness.ts` GET — `{stale, last_check_at, must_recheck}` from `visit_eligibility.checked_at` vs today (HCA-0789).
- `opd.routing.board.ts` GET — `queue_occupancy`; refresh if `refreshed_at` older than 3 min. HCA-0946/0947/0175/NEW-SR-01.
- `opd.routing.route.ts` POST — server-side specialty-lock: target clinic specialty must equal current required specialty, else 422 `specialty_mismatch`. Updates `clinic_bookings`, emits `booking_event`. HCA-0941/0761.
- `opd.orders.wallet-gate.ts` GET — `wallet_gate_open()` + balance (presentation).
- `_order-factory.ts` **extension** — before insert for OPD encounters: `wallet_gate_open(beneficiary, tenant)` false → 403 `wallet_gate` (file 17 §4). Gate order stays **forms gate → billed gate → wallet gate check at creation**.

## 3 · Client wiring — as v1 plan (`opdApi.cashier.*`, `opdApi.routing.*`, `opdApi.orders.walletGate`).

## 4 · UI — as v1 plan with three amendments

**a.** `CashierWorklistPane.tsx` (tab `finance-billing-op`, replaces stub) — as v1, plus: `billing_type` chip per row (from service join); "Raise pre-auth" button keyed on **request** status expired (KK3); Allocate disabled for the consultation-fee row only when `consultation-lock.locked` (KK2 — not at visit creation); cancel flow surfaces the 422/409 guard codes as inline reasons.

**b.** `RoutingBoardPane.tsx` (tab `opd-routing`) — as v1. Board is a **load monitor**; "Route here" appears only on clinic rows within the required specialty (file 14 correction (1) — never cross-specialty).

**c.** `OrdersPane` **amendment** — walletGate pre-check + inline banner; server 403 remains the boundary.

## 5 · Tests (target ≥117; baseline 107)

v1's six files, with these fixture corrections:

- `cashier-consultation-lock.test.ts` — locked when booking `in_consult` (NOT at `encounter_open`); unlocked while booking `arrived`; unlocked after doctor revert.
- `cashier-credit-note.test.ts` (NEW, 3) — performed item → 422 `item_already_performed`; consultation fee while locked → 409; successful cancel writes credit_note + wallet_txn + calls `wallet_apply_txn` (mock RPC log) + marks auth request cancelled.
- `cashier-allocate.test.ts` — wallet path asserts `wallet_apply_txn` in the RPC call log AND zero direct `patient_wallet` updates in `db.calls`.
- `wallet-gate.test.ts` — negative blocks at `_order-factory`; positive allows; missing wallet open.
- `routing-specialty-lock.test.ts` — cross-specialty → `specialty_mismatch`. Target ≥120 with the added credit-note file.

## 6 · Docs + debt

- Manual sections as v1, plus the KK2 lock-signal derivation and the KK6 guard order.
- `.lovable/plan.md`: resolve #29/#30/#37; **open #41** (ZATCA credit-note linkage) if step 5 of credit-note defers the VAT path.

## Definition of Done (delta over v1)

- [ ] `service_master.billing_type` exists with CHECK; charges route reads it via join (grep `charge_item.*billing_type` = 0).
- [ ] Plan-time psql output pasted for `wallet_txn_source_check` and `claim_status_check` before migrations commit.
- [ ] Occupancy triggers are `FOR EACH STATEMENT` (grep `FOR EACH ROW` in M-S4T2-03 = 0).
- [ ] Consultation lock keys on booking `in_consult`/journey fallback; fixture proves unlocked at `encounter_open`.
- [ ] Credit-note route enforces unperformed-only + consultation guard + auth revocation server-side; wallet credit flows through `wallet_apply_txn` (grep `UPDATE patient_wallet` = 0 repo-wide in new code).
- [ ] "Raise pre-auth" keys on `authorization_request.status='expired'` (grep `decision.*expired` = 0).
- [ ] Wallet-negative blocks order creation at `_order-factory` with 403 `wallet_gate`; OrdersPane banner renders.
- [ ] Routing route rejects cross-specialty server-side.
- [ ] ≥120 tests green; grep gates: `bill_item|bill\.` = 0 in touched files, raw palette = 0, `serviceClient|\.from\(` = 0 in daylight components.
- [ ] Debt register: #29/#30/#37 resolved; #41 opened if VAT path deferred.
- The two corrections with real business consequence:
  **KK2 is a patient-refund-rights issue, not a technical nit.** Locking the consultation fee at `encounter_open` means the moment reception creates the visit, the fee becomes non-cancellable — but HCA-0802's lock point is *consultation start*, and 0053 gives patients a cancellation window (with % deduction) before that. Lovable's version would have silently eliminated the patient's cancellation right at OPD. The booking `in_consult` transition is the correct signal and it already exists from Step 3's lifecycle work.
  **KK6 turns the credit-note route from a row-writer into an actual cancellation transaction.** The DoD acceptance row for 0952/0787/0820/0954 is explicit: unperformed-only, auth revocation, VAT adjustment, wallet Credit Note — four effects, one action. The v1 plan shipped one of the four. The performed-item guard especially matters because it's the reverse face of the billed gate: the gate stops perform-before-pay; this guard stops refund-after-perform.
  Post-build watchlist: (1) plan-time psql outputs for the two CHECK constraints actually pasted in the build report — that's the KK4 verification; (2) `FOR EACH STATEMENT` in the trigger migration; (3) the credit-note fixture asserting the RPC call log AND the absence of direct `patient_wallet` updates; (4) whether debt #41 opens (it probably should — OP tax invoices at claim assembly means the VAT path defers). Paste the build report when it lands.

Proceed to build.
## Turn 2 completion round — outcome

**Resolved:** #29 (E14 Cashier UI), #30 (E15 Routing Board), #37 (wallet-negative OPD order gate).
**Opened:** #41 — ZATCA credit-note linkage for pre-invoice cancellations. OP tax invoices are cut at claim assembly; credit-note route cancels charge_item + order_item + auth request and writes wallet credit via `wallet_apply_txn`, but no `tax_invoice` linkage exists yet because no invoice exists pre-claim. Defer to the claim-assembly / VAT engine turn.

Delivered:
- `opdApi.cashier.*`, `opdApi.routing.*`, `opdApi.orders.walletGate` client wrappers on `src/lib/clinical-api.ts`.
- `CashierWorklistPane` replaces `BillingOpPane` on `finance-billing-op` and new `opd-cashier` tab; `RoutingBoardPane` on new `opd-routing` tab (nav-config wired).
- `OrdersPane` renders wallet-gate banner (`data-testid=wallet-gate-banner`) when `opdApi.orders.walletGate` returns `open=false`.
- Wallet-gate check extracted to `src/lib/rcm/wallet-gate.ts::walletGateAllowsOrder`; `_order-factory` calls it and returns 403 `wallet_gate` unchanged.
- 5 fixtures added, 16 new tests: `wallet-gate` (4), `cashier-consultation-lock` (3), `cashier-allocate` (3), `cashier-credit-note` (4), `routing-specialty-lock` (2). Total suite 123 pass / 0 fail across 23 files.

Grep gates verified: zero direct `patient_wallet` updates in touched code; zero references to a `bill` / `bill_item` table; daylight components use `opdApi.*` only, never `serviceClient` / raw `.from(`.
