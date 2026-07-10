# Step 4 · Turn 5 — E2b Registration + Bulk-cancel (corrected v2, repo-verified @8e33f73)

Closes #38 (bulk-cancel body) + #40 (E2b consolidated registration). **This is Step 4's closeout turn.** Non-goals: #35 (QMS batch), #36 (Step 5), #41 (VAT engine turn), #42 (SMS gateway integration — but stubs wired this turn), #43 (D7 form bindings — Turn 5 fold if scope allows, else next-batch).

## Repo facts verified at plan-time (OVERRIDES v1 plan)

- `beneficiary` **columns confirmed:** `patient_file_no, first_name, middle_name, last_name, full_name, dob, gender, nationality, document_type, document_id, contact_number, ehealth_id, residency_type, marital_status, blood_group, preferred_language, email, address_line, address_street, address_city, address_district, address_state, address_postal_code, is_vip`. **No** `occupation`**, no** `country_code`**, no** `father_mrn`**, no** `is_newborn_under_mother`**, no** `hijri_dob` — all additive this turn.
- `visit_eligibility` **exists** (Turn 1 verified) — plan's assumption that it takes `financial_type/eligibility_type/eligibility_ref_no/payer/policy/class/network` is correct per file 14 §②. **Turn 1's** `opd.registration.eligibility-first.ts` **currently does NOT persist to** `visit_eligibility` — it returns `{ok, path}` only. This turn must fix that (NN6 below).
- **No** `provider_load` **/ live-queue table exists** (NN1). `providers` table has no counts; `queue_occupancy` is `(tenant_id, clinic_id)`, not per-provider. "In-queue count" per 0947 must derive from `clinic_bookings.status IN ('arrived','in_consult')` — no QMS dependency.
- `sms-gateway.ts` **exists** (Turn 3) with `sendPreauthUpdate`; needs two new stub entry points this turn (NN4, NN5).
- `coverage.expiry_date` **exists** (Turn 4 verified) — the eligibility-first route currently doesn't validate it (NN3).
- **Bulk-cancel SMS/WhatsApp (0732) and Create-Visit sticker replacement (0062) both hit the same stub sink** — `interface_log` — via distinct entry points so gateway swap-in is a single implementation.

## Plan-time psql (NON-OPTIONAL — paste outputs)

```sql
-- Beneficiary additive columns don't already exist
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='beneficiary'
   AND column_name IN ('occupation_ar','occupation_en','country_code','father_mrn','is_newborn_under_mother','hijri_dob');
-- Expected: 0 rows.

-- Coverage expiry check available
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='coverage' AND column_name='expiry_date';
-- Expected: 1 row.

-- visit_eligibility shape (for the persist path)
SELECT column_name, data_type, is_nullable FROM information_schema.columns
 WHERE table_schema='public' AND table_name='visit_eligibility' ORDER BY ordinal_position;

-- clinic_bookings.status enum values (for in-queue derivation)
SELECT enum_range(NULL::public.booking_status);

-- token_sequence sequences that exist (for token issuance)
SELECT sequencename FROM pg_sequences WHERE schemaname='public' AND sequencename ILIKE '%token%';

```

## 0 · Debt register fence (LANDS FIRST)

`.lovable/plan.md` row deltas only, `## Debt Register` single hit preserved. #38/#40 stay "open" until this turn closes; #43 (D7 form bindings) confirmed still open with owner "Turn 5 stretch, else next batch".

## 1 · Schema deltas

**M-S4T5-01 · Beneficiary demographics additive** (5 columns, all nullable, non-breaking):

```sql
ALTER TABLE public.beneficiary
  ADD COLUMN IF NOT EXISTS occupation_ar text NULL,
  ADD COLUMN IF NOT EXISTS occupation_en text NULL,
  ADD COLUMN IF NOT EXISTS country_code text NULL,   -- ISO E.164 dial code e.g. '+966'
  ADD COLUMN IF NOT EXISTS father_mrn text NULL,     -- 0056 reusable family MRN
  ADD COLUMN IF NOT EXISTS is_newborn_under_mother boolean NOT NULL DEFAULT false;  -- 0058

```

Hijri DOB is **NOT** stored (computed client-side from `dob` via Hijri library — NN2). Comment on `dob`: "Gregorian only; Hijri computed client-side per HCA-0051."

**M-S4T5-02 ·** `visit_eligibility` **persist support** (NN6) — if the table lacks an `eligibility_type` CHECK, add:

```sql
ALTER TABLE public.visit_eligibility
  ADD CONSTRAINT visit_eligibility_type_check
  CHECK (eligibility_type IN ('standard','referral','emergency','newborn'));

```

Add unique index on `(beneficiary_id, coverage_id, tenant_id, checked_at::date)` if not present — prevents duplicate-day rows.

**M-S4T5-03 · Bulk cancel event table**:

```sql
CREATE TABLE public.clinic_disruption (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  slot_at_from timestamptz NOT NULL,
  slot_at_to timestamptz NOT NULL,
  reason text NOT NULL,          -- e.g. 'or_emergency', 'shift_excuse'
  action text NOT NULL CHECK (action IN ('cancel','reschedule','reassign')),
  reassign_target_clinic_id uuid NULL REFERENCES public.clinics(id),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS + GRANTs same migration.

```

Tenant-scoped, admin+floor_manager write, all-clinical read.

## 2 · SMS stub additions — `src/lib/interface/sms-gateway.ts`

Two new no-op entry points (same signature shape, log to `interface_log`):

- `sendVisitConfirmation({tenant_id, phone_e164, lang, mrn_masked, visit_at, token_number, clinic_name})` — 0062 sticker replacement.
- `sendBulkCancelNotification({tenant_id, phone_e164, lang, encounter_id, reason, rebook_request_id})` — 0732 auto-notify.

Debt #42 remains the single "gateway integration" row — all three stubs (`sendPreauthUpdate`, `sendVisitConfirmation`, `sendBulkCancelNotification`) swap in together when a gateway lands.

## 3 · Server routes (all pure handlers, capIds, envelope)

**Refactor:** `opd.registration.eligibility-first.ts` **(NN6, NN3)** — currently returns `{ok, path}` without persisting. Extend to:

1. Validate coverage — expired coverage (coverage.expiry_date < today) → `422 coverage_expired` (new error code), unless `path='self_pay'`.
2. On any `ok` result (insured/self_pay/exception): UPSERT into `visit_eligibility` (`beneficiary_id, coverage_id, tenant_id`) with the resolved `eligibility_type`, `eligibility_ref_no` (from NPHIES response or NULL for self_pay/exception), `checked_at=now()`, `financial_type`. Return the `visit_eligibility.id`.

**New:** `opd.registration.create-visit.ts` **POST** `{beneficiary_id, department_id, provider_id, service_id, priority?}` — capId `opd.registration.create_visit` (front_office, tenant_admin). Server:

1. Look up latest `visit_eligibility` row for `(beneficiary_id, tenant_id)` within last 24h. Missing or stale → `409 eligibility_stale`.
2. If `eligibility_type='standard'` and last check was `not_eligible` → `403 not_eligible`.
3. Insert `encounter` (class=AMB, journey_state='encounter_open', coverage_id from visit_eligibility, episode_of_care resolution via Turn-1 pregnancy hook).
4. Insert `clinic_bookings` row today, status='confirmed' (walk-in), source='walk_in', provider_id, service_id.
5. Issue token via existing sequence or literal counter (NN1 stretch — see below).
6. Fire `sendVisitConfirmation()` stub (NN4).
7. Return `{encounter_id, booking_id, token_number}`.

**New:** `opd.registration.provider-load.ts` **GET** `?department_id&date=today` (NN1 corrected): Returns per-provider row: `{provider_id, display_name, booked_count, in_queue_count, priority_rank}` where `in_queue_count = COUNT(clinic_bookings.status IN ('arrived','in_consult'))` for the provider today. **No QMS dependency.** Comment cites "in-queue = on-site waiting per 0947; token-based queue counts land with QMS batch".

**New:** `opd.disruption.bulk-cancel.ts` **POST** `{clinic_id, slot_at_from, slot_at_to, reason, action, reassign_target_clinic_id?, cancellation_charge?: boolean}` — capId `opd.disruption.write` (floor_manager, tenant_admin):

1. Insert `clinic_disruption` row.
2. Select affected `clinic_bookings` (clinic_id + slot_at range + status NOT IN ('completed','cancelled')).
3. Bulk UPDATE per `action`:
  - `cancel` → status='cancelled', `cancellation_reason='hospital_initiated'` (no % deduction — 0053 contrast), `rebook_request=true` so they surface in the booking-request rail.
  - `reschedule` → status stays 'confirmed'; new `slot_at` computed via next-available on same provider (Step 3 scheduler); if crosses eligibility window (>24h from last check), stamp `eligibility_check_pending=true` (0789).
  - `reassign` → status='confirmed'; `clinic_id=reassign_target_clinic_id`; verify same specialty (Step 3 routing lock).
4. For each affected booking, fire `sendBulkCancelNotification()` stub (NN5).
5. Return `{affected_count, action_taken}`.

**Grep gate:** the bulk update MUST use a single UPDATE statement per action branch (not row-by-row) — Turn 2's statement-level occupancy trigger design assumes this.

## 4 · Client wiring

`opdApi.registration.{eligibilityFirst, createVisit, providerLoad}` + `opdApi.disruption.bulkCancel`.

## 5 · UI

`E2bRegistrationPane.tsx` — replaces `RegistrationPane` (old file removed after both refs updated). Three stacked `.clin-card`s in strict order:

- **① Demographics card** (§4.2): dual-calendar Gregorian↔Hijri (NN2 library: `moment-hijri`, licensed as MIT). Country code select (dropdown of ISO codes, default `+966`), then phone. Occupation single row AR + EN inputs. Father MRN reuse toggle when age <18. Newborn-under-mother toggle when age ≤30d and `is_newborn_under_mother` is settable. Blocking validation: MDS mandatory fields (0057) prevent save.
- **② Eligibility & payer card** (rendered second per HCA-0065): payer select, policy/class, network chip, referring-hospital dropdown (dept links), insurance referral letter upload (stub). "Check Eligibility" button calls `eligibilityFirst`. Result strip: **Eligible green** or **Not-eligible-or-Error red** with payer detail. On success, shows `eligibility_ref_no` and `approval_limit`. On not_eligible: exception path (`referral|emergency|newborn`) or block.
- **③ Visit details card** (final): department select → provider dropdown filtered to department (0946), each provider row shows `booked_count | in_queue_count` (NN1). Priority-physician list (0050 override). "Create visit & issue token" button disabled unless card ② returned `ok`. On success: token displayed, and "Send SMS/WhatsApp confirmation" auto-fires (NN4 stub — displays inline toast "SMS logged; gateway pending #42"). "Check specialty load" link opens routing board.

Nav: replace existing `RegistrationPane` binding with `E2bRegistrationPane` in `clinical.tsx`; no new tabs.

`ClinicDisruptionPane.tsx` (new tab `opd-disruption` under Worklists, floor_manager+tenant_admin caps): Session picker (clinic + date range slider), reason input, action radio (cancel/reschedule/reassign), reassign target picker (same-specialty only, uses routing board data). "Preview affected bookings" shows the list before commit. "Execute" calls `bulkCancel`, toast shows affected_count.

## 6 · Tests (target ≥164; baseline 150)

- `e2b-registration-flow.test.ts` (5) — happy: eligible → visit created → token issued → visit_eligibility persisted with ref_no + eligibility_type='standard'; expired coverage → 422 coverage_expired; missing eligibility → create-visit 409 eligibility_stale; stale (>24h) → 409; self_pay path skips NPHIES call (assert via db-mock call log).
- `provider-load.test.ts` (3) — booked_count computed from confirmed bookings; in_queue_count only from arrived+in_consult; empty department returns empty list.
- `bulk-cancel.test.ts` (4) — cancel branch marks all affected as cancelled with hospital_initiated reason + rebook_request=true; reschedule branch stamps eligibility_check_pending on crossings >24h; reassign branch fails on cross-specialty target with 422 specialty_mismatch; sendBulkCancelNotification stub called per affected row (mock call log).
- `sms-stub-shapes.test.ts` (2) — sendVisitConfirmation and sendBulkCancelNotification write to interface_log with expected payload shape.

## 7 · Docs + debt

`docs/his-technical-manual.md`: append "E2b Registration screen (front-office consolidated)" citing the three-card order + eligibility-persist + create-visit gate; "Bulk cancel (0732/0306/0357/0918)" documenting hospital-initiated no-charge semantics + notification hook.

`.lovable/plan.md` at close:

- #38 RESOLVED — clinic_disruption table + bulk-cancel route + `ClinicDisruptionPane`; hospital-initiated no % deduction; sendBulkCancelNotification stub.
- #40 RESOLVED — E2bRegistrationPane + eligibility-first persist + create-visit gate + provider-load derivation.
- #42 remains open (SMS gateway integration) — now three stub entry points ready.
- #43 D7 form bindings — evaluate at close whether Turn 5 can fold; else next batch.

## Definition of Done

- [ ] Plan-time psql outputs pasted BEFORE migrations (5 queries).
- [ ] Debt register fence landed FIRST; `## Debt Register` grep=1.
- [ ] Beneficiary additive columns all nullable; no schema breakage (grep new schema errors on demo reset = 0).
- [ ] `visit_eligibility` unique day-index in place; eligibility_type CHECK matches file 14 §② (`standard|referral|emergency|newborn`).
- [ ] `eligibility-first` route persists to `visit_eligibility` (grep INSERT/UPSERT into visit_eligibility = 1+).
- [ ] `create-visit` route reads `visit_eligibility`, rejects on stale/missing with 409 `eligibility_stale`; grep `coverage_id` in create-visit body params = 0 (comes from visit_eligibility row).
- [ ] Expired coverage returns 422 `coverage_expired`; grep in validation.ts.
- [ ] `provider-load` derives `in_queue_count` from `clinic_bookings.status IN ('arrived','in_consult')`; grep new queue tables = 0.
- [ ] `moment-hijri` (or equivalent) named in package.json for Hijri conversion; no server storage of Hijri (grep `hijri_dob` in migrations = 0).
- [ ] Both new SMS stubs (`sendVisitConfirmation`, `sendBulkCancelNotification`) call `interface_log` only; no fake sends (grep external fetch in sms-gateway.ts = 0).
- [ ] Bulk-cancel uses single UPDATE statements per action branch; grep row-by-row loops in bulk-cancel route = 0.
- [ ] Bulk-cancel cancel branch sets `hospital_initiated` reason and `rebook_request=true`; 0053 patient-window contrast documented in code comment.
- [ ] Reassign branch verifies same-specialty via Step 3 routing lock; cross-specialty → 422 specialty_mismatch.
- [ ] `E2bRegistrationPane` replaces `RegistrationPane`; both references updated; old file removed.
- [ ] `ClinicDisruptionPane` on new tab `opd-disruption`; cap-guarded.
- [ ] Test count ≥164 green; grep gates (raw palette, serviceClient/.from in daylight) = 0.
- [ ] Debt register: #38/#40 RESOLVED, #42 open, #21/#41/#43 open, #35/#36 parked.
    
    

- Post-build watchlist:

1. **Persistence proof:** grep for `INSERT INTO public.visit_eligibility` in the new `eligibility-first` handler and its fixture. If the fixture asserts on `visit_eligibility` state after the call, NN6 is real.
2. **Create-visit rejects on missing eligibility:** the `409 eligibility_stale` fixture must call create-visit *without* first calling eligibility-first, and assert the 409. Rejects the "just pass coverage_id in the body" shortcut.
3. **Bulk-cancel notification per row, not per action:** the mock call log for `sendBulkCancelNotification` should have `affected_count` entries, not 1. Row-by-row *notification* is fine; row-by-row *SQL update* isn't (Turn 2 statement-level trigger).
4. **Register single hit + no D7 sneak-in:** #43 stays open unless the resolution note explicitly says folded.