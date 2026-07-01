# RCM R4 verdict + R5 (Batching / Remittance / Denials) — validated, paste-ready

Validated against `velomedos@afa0704`.

---

## PART A — R4 `IpAdmissionsPane`: CORRECTLY WIRED, no amendment

`bill.ip` is a real cap; every `admission_request` column the pane reads exists (`admission_no`, `admission_serial`, `discharge_stage`, `room_type_entitled`, `requested_deposit_minor`, `paid_amount_minor`); `IP_BUCKET_LABEL`/`IP_BUCKET_ORDER`/`AdmissionBucket` (`ip-accounting-sm.ts`) and `toneOfIpBucket`/`toneOfAdmissionStatus` (`clinical-status.ts`) all resolve; bulk fans out with per-row results; daily-charges wired. Nothing to fix.

---

## PART B — R5 Batching / Remittance / Denials — corrected

R5 ships one migration + new routes. Six corrections; one is good news that shrinks the migration.

### [FIX 1 — claim.status is a CHECK, not an enum]

To let remittance advance claims to `paid`/`part_paid`/`denied`, **drop + re-add the** `claim_status_check` **CHECK** (exactly the pattern already used in migration `20260701200540`: `ALTER TABLE public.claim DROP CONSTRAINT IF EXISTS claim_status_check; ALTER TABLE public.claim ADD CONSTRAINT claim_status_check CHECK (status IN (…existing 14… , 'paid','part_paid','denied'))`). **Do not** use `ALTER TYPE … ADD VALUE` — there is no claim-status enum. Keep every existing value in the new set so live rows stay valid.

### [FIX 2 — journey_state is free text: settled/denied need NO migration]

`encounter.journey_state` is a plain `text` column (no enum, no CHECK), and `encounter_advance_journey(_enc_id, _to)` just `UPDATE`s it. So the remittance/denial triggers can set `settled`/`denied` **directly with zero schema change** and **no ADD VALUE hazard**. Delete the "`ALTER TYPE journey ADD VALUE`" idea entirely.

### [FIX 3 — correct the enum discipline statement]

The plan's "all new enums added via `ALTER TYPE … ADD VALUE` guarded by `IF NOT EXISTS`" is wrong here. Correct model: new batch/remittance/denial status vocabularies are **their own new** `CREATE TYPE … AS ENUM` (or text CHECKs) — safe same-txn. Existing sets: claim.status = CHECK (FIX 1); journey_state = free text (FIX 2). **No** `ADD VALUE` **to any existing enum in this migration.**

### [FIX 4 — no-op / duplicate schema]

`claims_officer` and `finance` **already exist** in `clinical_role` — **remove** the "adds … to the RCM role enum" step. `replaces_claim_id` **already exists** on `claim` — **don't re-add** it (use `IF NOT EXISTS` or omit). The genuinely new claim columns are `claim_sequence_no`, `batch_id`, `readiness_status`, `snapshot_locked_at`, `esign_ref` — add those.

### [FIX 5 — no `SmartTable`/`BulkActionBar`/`ReadinessBanner` framework exists]

These components were never built — every pane (Eligibility, Auth, Claims, IP) hand-rolls its table (`DCard` + `clin-table` + bucket tiles + bulk toolbar + drawer). Build the three R5 panes the **same hand-rolled way** as `ClaimsWorklistPane`/`IpAdmissionsPane` (shared `toneOf*`/`formatHalalas`/`CapGate`), or extract shared components first — don't import a framework that doesn't exist.

### [FIX 6 — guards + finance gating consistency]

Use `requireClinicalModule('Claims & Remittance', <cap>)` (method-aware GET-permissive) on the new routes, not bare `requireSupabaseAuth + assertTenantMember`. Gate remittance **post** on the existing finance-only cap `claim.post` via `CapGate`/`canPerform` — not a separate `has_role` check.

### [VERIFY — settlement target table]

No table literally named `bill` exists (the `paid_amount_minor` found is on `admission_request`). Confirm what `remittance_post_apply` actually settles — likely the `claim` aggregate + `charge_item` + `deposit.applied_to_bill_id`, or an OP invoice table if one exists. Bind the posting trigger to the real settlement table(s); don't `UPDATE bill.paid_amount_minor` on a table that isn't there.

### Confirmed-good — keep (integration)

- Routing: panes wired into `clinical.tsx` tabs (the plan targets it correctly this time) — confirm the tab ids match existing ones (e.g. `rcm-claims` / a finance tab), add new ones to the `TabId` union + `validateSearch`.
- New tables `claim_batch` / `remittance` / `remittance_line` / `denial_case` / `denial_communication` with own CREATE→GRANT→RLS→POLICY; `claim_sequence_no` grouping; `denial_case` idempotent per `claim_sequence_no`.
- Three SMs (`batch-sm`, `remittance-sm`, `denial-sm`); new blockers `BATCH_NOT_READY`, `SNAPSHOT_NOT_LOCKED`, `REMIT_UNMATCHED_LINES`, `DENIAL_OPEN` in `src/lib/rcm/validation.ts`.
- **R1–R4 linkage:** `remittance_post_apply` advances `claim.status` (new CHECK values) + settlement + `encounter.journey_state='settled'` (free text); denial opens → `journey_state='denied'`; R3 `ClaimDrawer` gains `batch_id`/`readiness_status`/denial+remit deep links; R2 `AUTH_MISSING` still gates readiness; R4 admission settlement reflected in `IpAdmissionsPane`.
- Bulk endpoints return `{ results: [{ id, ok, error? }] }`; interface/remittance intake stays sandboxed; D365 settlement summary is a contract-only stub (built in R7).

### DoD

One migration: new R5 tables (CREATE→GRANT→RLS→POLICY) + claim CHECK drop/re-add for `paid`/`part_paid`/`denied` + additive claim columns (`claim_sequence_no`/`batch_id`/`readiness_status`/ `snapshot_locked_at`/`esign_ref`; **not** `replaces_claim_id`, exists) + triggers (`claim_batch_advance_claim`, `remittance_post_apply`, `denial_case_from_response`). **No** `ALTER TYPE ADD VALUE`**; no journey_state migration; no role-enum change.** Routes under `requireClinicalModule('Claims & Remittance', …)`; post gated on `claim.post`. Panes hand-rolled into `clinical.tsx` tabs; new blockers in `validation.ts`; bulk per-row. Settlement trigger bound to the real table(s). `tsgo` green; Daylight only; halalas in mono; RTL-safe.