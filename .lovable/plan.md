# VeloMed Demo Kit — Final amendments (last pass)

The plan now folds in the prior round. Four remaining catches — two structural — to close before build. Nothing here is optional if the demo must be reproducible and the reset must leave a truly clean state.

## [FIX — structural] The seed can't be split SQL-migration + server-fn the way it's drawn

§2 seeds reference data **and** beneficiaries in `<ts>_demo_seed.sql`, while §2b requires **users before beneficiaries** (so `beneficiary.patient_user_id` resolves). These contradict: a SQL migration can't create auth users (that needs the Admin API) and runs *before* the provisioning server fn — so beneficiaries seeded in SQL can never reference the patient user. Resolve by splitting on capability, not convenience:

- **Migration (SQL)** = schema only: the `is_demo` flag + the §2c unique indexes. Optionally the pure-reference masters (no user dependency) **if** you want them in SQL — but one place only.
- **Server fn** `seedDemo()` = the entire data pipeline in order: `(masters if not in SQL) → provisionDemoUsers() → beneficiaries (patient_user_id resolved) → journeys → validate`. Do **not** seed beneficiaries or journeys in the SQL migration. The whole user→beneficiary→journey chain lives in the server fn, which runs with the **service-role admin client** (not an interactive session); the `/demo/seed` + `/demo/reset` HTTP endpoints are what's superadmin-gated.

## [FIX] Three identity axes — the roster mixes them; provisioning must too

The 13 accounts are not all `tenant_members + clinical_role`. There are three distinct identity axes, and `provisionDemoUsers()` must write the right one per account:

- **superadmin@demo** → platform `user_roles` row (`AppRole='superadmin'`). **No** `clinical_role`.
- **admin/doctor/nurse/coder/rcm/approver/cashier/biller/claims/finance/readonly** → `tenant_members` row with the matching `clinical_role`.
- **patient@demo** → an auth user **linked via** `beneficiary.patient_user_id` to the Insured-OP beneficiary. **Do NOT** give the patient a `tenant_members.clinical_role` row — otherwise the launcher treats them as clinical staff and they won't land on `/patient`. (A patient `AppRole` is fine if the app uses one; the clinical axis must stay empty for them.) Get this wrong and either the patient appears as staff or superadmin can't reach `/superadmin`.

## [FIX] Reset table inventory is incomplete — it omits the entire RCM transactional set

§5's delete list is clinical-spine-heavy and misses most of R1–R7. A reset that leaves those behind is not a clean state, and stale rows will corrupt the next demo. The delete set (FK-child-first, scoped `WHERE tenant_id=$demo`, in the one transaction) must **also** include:

- **R1**: `eligibility_exception` → `visit_eligibility`, `policy_activation_request`.
- **R2**: `authorization_communication`/`authorization_attachment`/`authorization_item` → `authorization_request`.
- **R3**: `bill_line` → `bill`; `wallet_txn` → `patient_wallet`; `credit_note`; `receipt`; `payment`.
- **R4**: `los_extension`, `bed_transfer`, `room_board_entitlement`, `admission_request`.
- **R5**: `remittance_line` → `remittance`; `denial_communication` → `denial_case`; `claim_batch`.
- **R6**: `deposit_transaction`/`deposit_attachment` → `deposit`; `refund_request`.
- **R7**: `cash_session_txn` → `cash_session`; `cash_refund`; `cash_collection`; `tax_invoice_line` → `tax_invoice`; `interface_log`. Best practice so this never drifts again: **tag each table** transactional-vs-reference (a comment convention or a small registry) and have reset delete the transactional set in dependency order, rather than a hand-maintained list that silently goes stale as phases add tables. At minimum, enumerate against the actual phase migrations and assert the demo row-count is zero post-delete (pre-reseed) for every transactional table.

## [FIX] Verify natural-key columns + table names against the real schema — don't assume

The §2c `ON CONFLICT` targets assume a `code` column on every master. Several likely differ — confirm each against the actual phase migration before writing the upsert:

- `price_list` has no obvious `code` (it's `name` + `scope_level` + scope FK); its natural key is more like `(tenant_id, scope_level, scope_ref_id, name)` or an explicit `code` you add. Don't assume.
- `drg`, `payer`, `tpa`, `service_master`, `drug_master` — confirm the unique column is `code` vs `drg_code`/`service_code`/`payer_code`/`gtin`/`mrid`. The grouper/coding tables snapshot `drg_code`, so the reference table's key may be `drg_code`, not `code`. And two table-name checks in the reset/stub lists:
- `nphies_message` is the Phase-9 log name (the plan writes `nphies_message_log`). Use the real one.
- The dispense table from Phase 4 — confirm it's `medication_administrations` vs `dispense`/ `medication_dispense` before deleting it. A single wrong identifier here fails the seed or the reset at runtime — exactly the "podium" risk.

## [ENHANCE] Seed a staged, unposted remittance for the finance step

The script's step 7 includes "post a remittance," but the seed only creates a denied claim. Mirror that: seed one `remittance` **+** `remittance_line` **matched to the submitted claim, status=staged** (not yet posted), so the finance user has real content to post during the demo — the same way the `denial_case` gives the resubmit worklist content.

## Otherwise: good to build

Demo isolation, sandbox-forcing with `interface_log` writes, the banner, the MDS-complete journeys with the post-seed validator re-run (excellent — that's the single most important guard), the reset transaction with `is_demo` assertion, the access sheet, and the guardrails all stand.

### Updated acceptance (add)

- Seeding is one ordered server-fn pipeline; no beneficiary/journey rows originate in a SQL migration.
- superadmin reaches `/superadmin`; patient reaches `/patient`; neither has the wrong identity row.
- After `reset`, **every** transactional table (clinical **and** R1–R7) has zero `tenant_id=$demo` rows before reseed; no other tenant is touched.
- A finance user can post the seeded staged remittance; a claims user can resubmit the seeded denial.  
