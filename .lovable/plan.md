# Step 3 — Scheduling + Referral data + Clinic Day Board (v3, both addenda folded)

Consumes: `referral` / `referral_target` (Step 1 M11), `pricing_rule scope='referral'` seed rows A/B/C (Step 1 M17), `clinic_bookings.origin_encounter_id` + `.source` (bound to `visit_source`), 10 module worklists, `<BilledGate>` / `<FormsGate>` / `<RcmCommCard>` / `<HimCommCard>` primitives, `**src/lib/mds/rules.ts::evaluateTriggers**` (scope-parameterized generic — not `auth-engine.ts`).

**Not this step:** Referral Cockpit, Cross-Encounter / Inter-Company / External screens, `health_cluster`, Rule Engine admin — Step 5.

## Plan-time verification (executed @b1e6ba4)

- `clinic_bookings.status` → `udt_name='booking_status'` (enum-bound). **AA1 short path** — single-migration `ALTER TYPE ... ADD VALUE`.
- `service_master` rows matching `%physio%|%rehab%|%dialysis%|%therapy%` → **0 rows**. **Minor: backfill is a documented no-op**; migration includes UPDATE with `-- TODO Batch-C: series-therapy service catalog not yet seeded` comment.
- `code_system` + `code_value` exist → V4 path A (seed `slot_block_reason`).
- `referral_target.booked_appointment_id` exists → V3 confirmed.
- `clinic_slot` doesn't exist → `held_until timestamptz NULL` ships in CREATE.
- `src/lib/mds/rules.ts::matches()` is flat-equality only → AA2 extension required.
- Existing `TriggerOutcome` / `foldTriggerOutcome` already returns `eligibility_check_required` and `charge_mode` — no reshape needed.

## Turn split (hard sequence)

- **Turn 1** — Enum migration → tables + booking lifecycle + `rules.ts` extensions. No screens.
- **Turn 2** — Generic Day Board + Schedule Setup + Booking-request rail + drop-validate with atomic held-slot claim + post-book eligibility endpoint.
- **Turn 3** — Referral wiring + tests + docs.

## Turn 1 — Data layer

### Migration 1 (enum-only, first — R1)

```sql
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'arrived';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'in_consult';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'no_show';
```

### Migration 2 (tables + columns + triggers + seeds)

**New tables** (GRANT + RLS + policies per convention):

- `clinic_schedule` — session template incl. badges (`allow_parallel_clinics`, `telemedicine_capable`, `procedure_room`, `wheelchair_access`, `female_clinic`), status CHECK `('open','modified','closed')`, `priority_rank`, `overbook_allowed`, `overbook_limit`.
- `clinic_slot(id, tenant_id, schedule_id, slot_at, capacity, booked_count, status public.slot_status, held_until timestamptz NULL)` — UNIQUE `(schedule_id, slot_at)`; unique-provider-slot via BEFORE INSERT trigger reading `clinic_schedule.allow_parallel_clinics`.
- `slot_block(id, tenant_id, schedule_id NULL, slot_id NULL, reason_code text, note, blocked_by, notify_stakeholders bool)` — `reason_code` validated (trigger) against `code_value` where `code_system.code='slot_block_reason'`.
- `booking_event(id, tenant_id, booking_id, event, at, by)` — INSERT-only from triggers.

**Column extensions on `clinic_bookings**` (idempotent):
`provider_id`, `visit_type public.visit_type NULL`, `origin_encounter_id → encounter(id)`, `referral_target_id → referral_target(id)`, `overbooked bool DEFAULT false`, `confirmed_at`, `no_show bool DEFAULT false`, `series_id uuid NULL`, `**eligibility_check_pending bool DEFAULT false**`, `**eligibility_checked_at timestamptz NULL**`, `**eligibility_response jsonb NULL**` (AA4).

**Triggers:**

- `clinic_bookings_status_guard` (BEFORE UPDATE) — lifecycle `requested → confirmed → arrived → in_consult → completed`; `no_show` only from `confirmed`; cancel from any pre-consult; illegal → `P0001`. `confirmed` requires `eligibility_check_pending=false`.
- `clinic_bookings_emit_event` (AFTER INSERT/UPDATE) — writes `booking_event` on status change.
- `clinic_slot_reserve` (BEFORE INSERT on `clinic_bookings`) — increments `booked_count`; blocks past `capacity + overbook_limit`; sets `overbooked=true` when > capacity ≤ overbook_limit and `overbook_allowed`. Route enforces privilege before insert.
- `clinic_slot_release_held` helper — lazy: `status='held' AND held_until < now()` → `open`.

**Seeds:**

- `code_system('slot_block_reason', …)` + `code_value` starters: `doctor_leave`, `equipment_down`, `or_case`, `holiday`, `ramadan_hours`, `admin_hold`.
- `service_master.sub_category = 'series_therapy'` backfill — **0-row no-op** (verified); migration includes UPDATE with Batch-C dependency comment.
- Update `REF_SERIES` (`pricing_rule` scope='referral') action payload to key off `sub_category='series_therapy'` (V5).

### Engine wiring — `src/lib/mds/rules.ts` ONLY (V2, AA2, AA3)

**Extend `matches()**` with operator shapes while preserving flat-equality backward compat:

```ts
if (v !== null && typeof v === 'object' && !Array.isArray(v) && 'op' in v) {
  const { op, value } = v as { op: string; value: unknown };
  switch (op) {
    case 'lte': /* numeric <= */; break;
    case 'gte': /* numeric >= */; break;
    case 'lt' : /* numeric <  */; break;
    case 'gt' : /* numeric >  */; break;
    case 'in' : /* array.includes */; break;
    default: return false;
  }
} else if (factVal !== v) return false;
```

Rule B condition → `{"days_since_last_visit":{"op":"lte","value":14}}`. Rule C → `{"days_since_last_visit":{"op":"gte","value":15}}`. Existing rule payloads (flat equality) unaffected.

**Extend `RuleFacts` — all new fields OPTIONAL (AA3):**

```ts
referral_class?: 'intra' | 'inter_company' | 'external' | 'cross_encounter';
source_specialty?: string;
target_specialty?: string;
days_since_last_visit?: number;
service_id?: string;
sub_category?: string;
coverage_id?: string;
```

Existing consumers (`pricing.ts`, `pbm-engine.ts`, `billed-gate.test.ts`, `evaluate()`) typecheck without modification. `matches()` fails-closed when a rule references a missing fact (existing `undefined !== v`).

`evaluateTriggers(rules, facts, scope)` already accepts `scope`; `foldTriggerOutcome` already returns `{ preauth_required, charge_mode, discount, eligibility_check_required, block_reason }`. Referral seed rows A/B/C drive their branches via existing action shapes; 14-day boundary reads `service_master` follow-up window per specialty (fallback 14, HCA-0198).

**Do not modify `src/lib/rcm/auth-engine.ts**` (V2 — grep must show 0 new hits).

**Turn 1 tests (6):** Rule A other-specialty pre-auth; Rule B day-14 → `follow_up`; Rule B day-15 → `new_consult`; Rule C MRP-shift no-charge (hospital reason); Rule C MRP-shift new-consult (patient reason); Rule C series ties to original via `sub_category='series_therapy'`.

## Turn 2 — Day Board + Schedule Setup

### Generic component (V7)

`src/components/clinical/daylight/scheduler/DayBoard.tsx` — parameterized by `SuiteConfig<TSlot, TBooking>`. **Zero suite literals in this file**.

```ts
export interface SuiteConfig<TSlot, TBooking> {
  suite: 'opd_clinic' | 'or' | 'cath' | 'diagnostic';
  columnBadges: (session: SessionMeta) => BadgeChip[];
  slotColor: (slot: TSlot, booking: TBooking | null) => SlotColorToken;
  validateDrop: (payload: DropPayload) => Promise<DropValidation>;
  hoverCard: (slot: TSlot, booking: TBooking | null) => React.ReactNode;
  walkInSuggester: (specialty: string, from: Date) => SlotHandle[];
}
```

Sub-components under `daylight/scheduler/`: `DayBoardColumn`, `SlotCell`, `SessionHeader`, `BookingRequestRail`, `WalkInLane`.
OPD binding: `daylight/scheduler/suites/opd-clinic.ts` — the only place OPD literals live.

Slot colors: Open white → Booked muted → Confirmed blue → Arrived teal → In-consult green → Completed grey → No-Show red → Blocked hatched. `**<clin-pill.warn>` "Eligibility pending"** chip when `eligibility_check_pending=true` (AA4).

### View

`v_clinic_day_board` (SECURITY INVOKER, GRANT SELECT to authenticated) — joins schedule × slot × booking × slot_block × service_master approx-time. Exposes `eligibility_check_pending`. `NULL::text AS token` placeholder (Step 2 debt #14).

### Server routes (cap-guarded)

- `GET /scheduler/board` — reads `v_clinic_day_board`.
- `GET /scheduler/booking-requests` — referrals awaiting + follow-ups due + rebooks + portal/call-center.
- `POST /scheduler/validate-drop` — chain: capacity/overbook → visit-type approx-time fits → OR restriction (`slot_block` reason `or_case`) → gender/female-clinic + age → 14-day repeat via `rules.ts::evaluateTriggers(scope='referral')`. **Does NOT call `/eligibility/check**` (AA4); if outcome carries `eligibility_check_required`, book stamps `eligibility_check_pending=true`. On success, **atomic held-slot claim (AA5)**:
  ```sql
  UPDATE public.clinic_slot
     SET status='held', held_until = now() + interval '90 seconds'
   WHERE id=$1 AND status='open'
  RETURNING id, held_until;
  ```
  0 rows → `{ ok:false, reason:'slot_just_taken' }`. 1 row → `{ ok:true, hold_token: held_until, needs_eligibility_check: boolean }`.
- `POST /scheduler/book` — atomic claim (AA5):
  ```sql
  UPDATE public.clinic_slot
     SET status='booked', held_until=NULL
   WHERE id=$1 AND status='held' AND held_until > now()
  RETURNING id;
  ```
  0 rows → `409 SLOT_UNAVAILABLE`. 1 row → insert booking (same txn) with `eligibility_check_pending` from validate-drop outcome. Overbook privilege checked server-side before `overbooked=true`.
- `PATCH /scheduler/bookings/$id/status` — `arrived / in_consult / completed / cancelled`. `no_show` rejected (trigger-only, from `confirmed`). `confirmed` transition requires `eligibility_check_pending=false`.
- `**POST /scheduler/bookings/$id/eligibility-check**` (AA4) — runs NPHIES call, caches `eligibility_checked_at` + `eligibility_response`, clears `eligibility_check_pending`.
- `POST /scheduler/blocks` — validates `reason_code` against `code_value` set.

### Capabilities (`clinical-role-matrix.ts`)

- `scheduler.board.read` → front_office, tenant_admin, physician, nurse
- `scheduler.book.write` → front_office, tenant_admin
- `scheduler.overbook` → front_office, tenant_admin (server-checked)
- `scheduler.block.write` → front_office, tenant_admin, floor_manager
- `scheduler.disruption.write` → floor_manager, tenant_admin
- `scheduler.eligibility.run` → front_office, tenant_admin, nurse

### Nav + tab

Add `wl-day-board` to `NavTabId` + Scheduling nav group + tab switch in `clinical.tsx`. **No sibling route file**. Fixed `<RcmCommCard>` on booking surface (Policy Activation channel). One-click chain: Arrived → token (`NULL::text` placeholder) → eligibility banner → co-pay shortcut → Nursing Workbench.

### Session & Clinic Setup sub-pane

Add/close sessions, capacity + overbook, extra slots, block-outs. Delete-with-future-bookings refused → thin bulk-transfer wizard scaffold (full disruption flow deferred).

## Turn 3 — Referral wiring + tests + docs

- `POST /api/clinical/v1/referrals/$id/targets/$targetId/book` — creates booking, sets `**referral_target.booked_appointment_id**` (V3), transitions target to `booking`.
- Booking-request rail surfaces `referral_target` rows where `target_kind IN ('provider','specialty') AND status='requested'`.

**Tests (target ≥22 green):**

- Engine (6, from Turn 1).
- Booking lifecycle (5): legal transitions, `no_show` blocked from non-`confirmed`, cancel from any pre-consult, illegal rejected with `P0001`, series booking under one `series_id`.
- Drop-validate (8): capacity full blocks, overbook within limit stamps flag, overbook past limit blocks, visit-type approx-time fits, 14-day repeat block engages, `**eligibility_check_pending` stamped on booking + drop-validate does NOT call `/eligibility/check**` (grep + spy), gender/female-clinic honored, age rule honored.
- **Held-slot race (1) — TWO concurrent `validate-drop` calls** on the same slot: exactly one gets `ok:true`, other returns `slot_just_taken` (AA5).
- KPIs (2): `booking_event` yields slot-utilization % and no-show rate correctly.

Docs: `docs/his-technical-manual.md` — Scheduling + Referral section (data model, `rules.ts` engine wiring with operator shapes, drop-validator contract, held-slot claim protocol, post-book eligibility pattern).

## Definition of Done (behavior-verifiable)

1. Plan-time psql on `clinic_bookings.status` executed BEFORE Migration 1; short path taken (verified: `udt_name='booking_status'`).
2. Enum migration lands before consumer migration.
3. `booking_event` fires on every status change.
4. `no_show` reachable only from `confirmed` (trigger raises `P0001` otherwise).
5. `rules.ts::matches()` supports flat equality AND `{op,value}` shape; existing rule payloads still pass `evaluate()` (grep + tests).
6. Rule B uses `{op:'lte',value:14}`; Rule C uses `{op:'gte',value:15}`.
7. All new `RuleFacts` fields optional; `pricing.ts` / `pbm-engine.ts` / `billed-gate.test.ts` typecheck unchanged.
8. `grep 'referral' src/lib/rcm/auth-engine.ts` returns 0 new hits.
9. All referral-booking routes reference `booked_appointment_id`, never `clinic_booking_id`.
10. `code_value.slot_block_reason` set seeded; `slot_block.reason_code` validated against it.
11. `series_therapy` backfill executed (0-row no-op, documented in migration comment); `REF_SERIES` payload references `sub_category='series_therapy'`.
12. `clinic_slot.held_until` exists; `validate-drop` **uses atomic** `UPDATE ... WHERE status='open' RETURNING id, held_until`; loser returns `slot_just_taken`.
13. `book` **uses atomic** `UPDATE ... WHERE status='held' AND held_until > now() RETURNING id`; loser returns `409 SLOT_UNAVAILABLE`.
14. **Drop-validate does NOT call** `/api/clinical/v1/eligibility/check` (grep endpoint impl).
15. `clinic_bookings.eligibility_check_pending` / `.eligibility_checked_at` / `.eligibility_response` columns exist.
16. `POST /scheduler/bookings/$id/eligibility-check` endpoint exists and caches on booking row.
17. Day Board renders "Eligibility pending" chip when flag true.
18. `SuiteConfig<TSlot,TBooking>` exported from `DayBoard.tsx`; `grep -E "opd_|clinic_" DayBoard.tsx` returns 0.
19. Overbook privilege checked server-side before `overbooked=true`.
20. Nav shows Day Board tab in Scheduling group; `ls src/routes/_authenticated/` unchanged.
21. All new public tables have GRANT + RLS + policies; Supabase linter clean.
22. **Held-slot race test uses TWO concurrent** `validate-drop` **calls (not** `book`**)** — one `ok:true`, one `slot_just_taken`.
23. Tests ≥22 pass / 0 fail.

## Step 3 — Correction Addendum v3 (append to Lovable's v3 plan; three residuals)

## v3 plan absorbed both prior addendums correctly. Three residual issues surfaced only on deep-read of the interacting corrections. Two behavioral, one hygiene.

## BB1 — Rule B/C SEED PAYLOADS must be rewritten to use operator shapes

## The plan extended matches() to accept {op, value} shapes and says Rule B/C conditions "→ {op:'lte',value:14} / {op:'gte',value:15}." But the actual seed rows in Step 1 M17 use different keys entirely:

## Rule B: {"target_specialty_differs":false, "days_since_last_visit_max":14} — custom key _max, no operator

## Rule C: {"days_since_last_visit_min":15} — custom key _min, no operator

## Migration 2 must include the UPDATE against pricing_rule to rewrite the conditions:

## Sql

## Without this UPDATE, extending matches() is a no-op for referral rules — the seed keys don't match anything in the code. Rules B/C silently never fire.

## BB2 — foldTriggerOutcome resolver and sub_category flag design collide

## The v5 sub_category flag design (series_therapy on service catalog) is inconsistent with what foldTriggerOutcome actually reads. Verified in rules.ts lines 150-200: the series_or_no_charge resolver reads a.series_specialties (array from Rule C payload) matched against facts.target_specialty. Not facts.sub_category.

## Two files change, both in Turn 1:

## 1. Rule C payload rewrite (in Migration 2's seed UPDATE):

## Sql

## 2. foldTriggerOutcome change in src/lib/mds/rules.ts:

## Replace the resolver block (lines ~168-175):

## Ts

## And update the foldTriggerOutcome facts signature: facts?: { target_specialty?: string | null; sub_category?: string | null }.

## Then the existing PBM fold fixture in billed-gate.test.ts needs a companion referral-C fixture: hit with series_or_no_charge action + facts.sub_category='series_therapy' → charge_mode: 'series'; same hit + facts.sub_category=null → charge_mode: 'no_charge'. Add to Turn-1 test count (7 total, not 6).

## BB3 — Guard trigger must stamp confirmed_at

## Plan adds confirmed_at timestamptz NULL to clinic_bookings but doesn't say when it's written. clinic_bookings_status_guard (BEFORE UPDATE) is the natural home. Extend the trigger:

## Sql

## Without this the column is dead. The no_show boolean sync is a small hygiene bonus — the plan already has no_show bool DEFAULT false and enum value 'no_show', both should agree.

## Added DoD

## [ ] Rule B/C seed conditions rewritten in Migration 2 to {days_since_last_visit: {op, value}} shape; grep days_since_last_visit_max / _min in pricing_rule returns 0 rows post-migration.

## [ ] Rule C action rewritten to use series_sub_category (not series_specialties); grep verifies.

## [ ] foldTriggerOutcome resolver reads facts.sub_category; test fixture proves series/no_charge branch selection via sub_category.

## [ ] Test count for Turn 1 is 7 (6 originally planned + 1 sub_category resolver fixture).

## [ ] clinic_bookings_status_guard stamps confirmed_at = now() on requested → confirmed; boolean no_show synced with status 'no_show'.

## [ ] Existing PBM / pricing rule payloads (flat equality) still pass matches() (backward-compat test).

## Sequencing

Turn 1 (data + `rules.ts` extensions) → Turn 2 (board + setup + atomic held-slot claim + post-book eligibility endpoint) → Turn 3 (referral wiring + tests + docs). Each turn ships its own migration set + grep-verifiable DoD subset.