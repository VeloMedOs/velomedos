# Step 5 · Turn 2 — Referral write endpoints (repo-verified @66ea97f)

**Basis:** File 08 §B (Referral write flows) + §C (Rules A/B/C evaluation on write) + debt #45.

Closes **#45** (referral write endpoints — cross-encounter fan-out, inter-company target creation, series booking). Non-goals: **#22** (referral_network still open — external write stays skeleton), **#18/#19/#20/#21/#23/#41/#42/#43/#44** (all preserved as-open), **#35/#36** (parked — #36 resolved-in-part by Turn 1 read side + Turn 2 write side).

## Repo facts verified at plan-time (OVERRIDES v1 file 08 assumptions)

- `referral.status` **is a Postgres enum** `public.referral_status = ('draft','submitted','accepted','declined','completed','cancelled')`. File 08 §B1 uses text values `('requested','booking','eligibility','preauth','confirmed','completed','rejected')` — those are **spec-inference, not the shipped enum**. All Turn 2 writes use the shipped enum values.
- `referral_target.status` — grep returned empty for CHECK; column defined as `status text` in the base migration (Step 3). Values used in code: `'requested','submitted','accepted','declined','completed','cancelled'` — plan-time psql to confirm actual CHECK.
- `admission_request` **exists** with cols `id, tenant_id, encounter_id, beneficiary_id, admission_no, admission_serial, request_type, mrp_id, consent_id, payer_id, …`. Cross-encounter → IPD fan-out writes here.
- `encounter_emergency` **exists** with cols `id, tenant_id, encounter_id, triage_date, triage_category, emergency_arrival_code, emergency_service_start, emergency_department_disposition, …`. Cross-encounter → ER fan-out creates an `encounter` (class='EMER') first, then an `encounter_emergency` row against it.
- `electrophysiology_order` **exists** — cath/EP cross-encounter target.
- `maternity_protocol` **does NOT exist as an encounter target**. Maternity uses `episode_of_care(care_type='pregnancy')` (Step 4 Turn 4). Cross-encounter → L&D fan-out creates an encounter with `episode_of_care_id` set, or opens a new pregnancy episode if none active.
- `surgery_booking` **does NOT exist**. File 08 §B3 references "surgery/cath/procedure request" — this maps to `electrophysiology_order` (cath/EP) plus a to-be-created surgery-booking table (out of Turn 2 scope; skeleton stub). Debt row opens.
- `clinic_bookings.series_id` **exists** (M13) with index. Turn 2 wires series booking against this.
- `evaluateTriggers({scope:'referral', facts})` **verified working** (line 148 in `src/lib/mds/rules.ts`), returns 5-field decision (`preauth_required, charge_mode, discount, eligibility_check_required, block_reason`). Rules A/B/C tested `rules-referral.test.ts`.
- **Nutrition auto-referrals sit as** `status='draft'` **with** `source_key LIKE 'nutrition_screen:%'` (Step 4 Turn 4). Turn 2 "accept referral" write endpoint promotes them to `'submitted'` → fan-out.
- **No** `referral_network` **table** — external write path remains blocked. Skeleton pane from Turn 1 stays.

## Plan-time psql (NON-OPTIONAL — paste outputs)

```sql
-- referral_target.status actual values (CHECK vs plain text vs enum)
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname LIKE 'referral_target%status%';
SELECT column_name, data_type, is_nullable FROM information_schema.columns
 WHERE table_schema='public' AND table_name='referral_target' AND column_name='status';

-- admission_request required cols
SELECT column_name, is_nullable, column_default FROM information_schema.columns
 WHERE table_schema='public' AND table_name='admission_request'
   AND is_nullable='NO' AND column_default IS NULL;

-- encounter class enum values (need EMER for ER fan-out)
SELECT enum_range(NULL::public.encounter_class);

```

## 0 · Debt register fence (LANDS FIRST)

`.lovable/plan.md` row deltas only, `## Debt Register` single hit preserved. Add new #46 for surgery-booking target if scope allows this turn; if deferred, note owner clearly.

## 1 · Schema deltas (thin — write path additions, no rebuilds)

**M-S5T2-01 ·** `referral.origin_source` **audit trail** — additive, tracks whether a fan-out came from a doctor's direct multi-target referral vs auto-generated. Not strictly required for functionality; adds `origin_source text NULL` (values: `'doctor_direct'`, `'auto_nutrition'`, `'auto_maternity_gdm'`, `'auto_other'`). Simplifies register debug when auto-generated referrals fan out.

**M-S5T2-02 ·** `referral_target` **idempotency substrate** (same convention as Step 4 Turn 4 nutrition):

```sql
ALTER TABLE public.referral_target
  ADD COLUMN IF NOT EXISTS source_key text NULL;
CREATE UNIQUE INDEX IF NOT EXISTS referral_target_source_key_uidx
  ON public.referral_target(tenant_id, source_key) WHERE source_key IS NOT NULL;

```

Used for cross-encounter fan-out dedup: if `referral_target.target_kind='encounter'` and `source_key='cross_enc:{referral_id}:{target_kind}'`, dedup on retry.

**M-S5T2-03 · Surgery target skeleton (CONDITIONAL — DEFERRED to Batch C_05 OR)** Do NOT create surgery_booking this turn. Instead, `referral_target.target_kind='encounter'` with `target_encounter_type='OR'` is written; cross-encounter route rejects with `422 target_kind_not_ready` and opens debt #46. Frontend renders a "OR referral pending — Batch C_05" state per file 08's non-goal treatment.

## 2 · Server routes (`src/routes/api/clinical/v1/opd/`)

New capIds: `referral.create` (physician, tenant_admin), `referral.fan_out` (physician, tenant_admin), `referral.inter_company.create` (tenant_admin, rcm_officer), `referral.series.create` (physician, tenant_admin). `referral.external.create` explicitly NOT added — blocked by #22.

- `opd.referral.create.ts` POST `{source_encounter_id, target_kind, target_specialty?, target_provider_id?, target_facility_id?, target_service_id?, reason, clinical_notes?}`
  - `evaluateTriggers({scope:'referral', facts:{same_specialty, days_since_original, sub_category, class_id, dental?, ...}})` runs pre-write
  - Writes `referral(status='draft')` + one `referral_target(status='requested')` atomically
  - Rule A → `referral_target.preauth_required=true, charge_mode='new_consult'` (spec words per Rule A returned in decision)
  - Rule B → `preauth_required=false, charge_mode='follow_up'`
  - Rule C series → `charge_mode='series'` + `series_id` set (if pre-approved series specialty per debt #18 config)
  - Returns `{referral_id, target_id, engine_decision}`
  - **Idempotency:** `source_key='doctor_direct:{source_encounter_id}:{target_specialty|target_provider_id}'` — same doctor's re-click doesn't create duplicate targets
- `opd.referral.fan-out.ts` POST `{referral_id, targets:[{target_kind, ...target_specific_fields}]}` — multi-target fan-out from a single referral (file 08 §B B2 "one referral → many targets")
  - For each `target_kind`:
    - `'specialty'` → creates new `clinic_bookings` (specialty booking) OR just a `referral_target` awaiting front-office booking
    - `'encounter'` with `target_encounter_type='ER'` → creates `encounter(class='EMER')` + `encounter_emergency` row; target linked
    - `'encounter'` with `target_encounter_type='IPD'` → creates `admission_request` (medical admission); target linked; room&board auto-preauth (HCA-0072) fires if configured
    - `'encounter'` with `target_encounter_type='EP'` → creates `electrophysiology_order`; target linked
    - `'encounter'` with `target_encounter_type='L&D'` → creates encounter with `episode_of_care_id` (existing active pregnancy episode, or creates new via Turn 4's pregnancy-episode.link path)
    - `'encounter'` with `target_encounter_type='OR'` → **rejects with** `422 target_kind_not_ready`**, opens debt #46**
    - `'entity'` (inter-company) → see `opd.referral.inter-company.ts`
    - `'external_facility'` → **rejects with** `403 external_blocked`**, banner cites debt #22**
  - Each target gets `source_key='cross_enc:{referral_id}:{target_encounter_type}'` for idempotency
  - Returns `{referral_id, targets:[{target_id, status, engine_decision, sibling_write:{table, id}?}]}`
  - Each fan-out is a **single transaction**: referral_target + sibling row (admission_request/encounter_emergency/…) written atomically; failure rolls back
- `opd.referral.inter-company.create.ts` POST `{referral_id, target_entity_id, target_specialty?, target_provider_id?}` — inter-company target creation
  - **Verifies caller tenant's** `cluster_id` **matches target_entity_id's** `cluster_id` (rejects `403 cluster_mismatch` otherwise)
  - Creates `referral_target(target_kind='entity', target_entity_id=<sibling tenant uuid>, source_key='inter_co:{referral_id}:{target_entity_id}')`
  - Writes the target **in the sending tenant's** context (referral_target belongs to source tenant); the SIBLING tenant's front-office reads via `referral.inter-company.ts` (Turn 1 read pane already handles this)
  - Fires notification stub to sibling tenant (via existing sms-gateway or interface_log stub — same pattern as bulk-cancel notify)
  - Returns `{target_id, sibling_tenant_id}`
- `opd.referral.series.create.ts` POST `{origin_encounter_id, service_id, session_count, cadence_days, first_session_at?}` — series booking (physio, dialysis, psychotherapy)
  - Verifies service belongs to a "pre-approved series specialty" via config lookup — if not, rejects `422 not_a_series_specialty` (debt #18 seed dependency)
  - Creates a single `referral(status='accepted', charge_mode='series')`, single `referral_target(status='accepted')`
  - Creates N `clinic_bookings(source='referral', visit_type='series', series_id=<generated>)` at `first_session_at + i*cadence_days`
  - Session 1 = the current visit; sessions 2..N = future bookings
  - Returns `{referral_id, series_id, booking_ids:[]}`
  - Idempotency: `source_key='series:{origin_encounter_id}:{service_id}'`

Extend `opd.nutrition.referrals.pending.ts` with POST `{referral_id, action: 'accept'|'decline', notes?}` — allows the doctor to formally accept/decline auto-generated nutrition referrals from Turn 4. Accept → runs `evaluateTriggers` + writes `referral_target` (specialty=nutrition) + optionally auto-books first slot. Decline → sets `status='declined'`.

Each route: pure-handler pattern, capIds, standard envelope, `rules.ts::evaluateTriggers` called on write path.

## 3 · Client wiring

`referralWritesApi.create(body)` · `.fanOut(body)` · `.interCompany(body)` · `.series(body)` · `.acceptNutrition({referral_id, action})`. All in `src/lib/clinical-api.ts`.

## 4 · UI additions (no new tabs — additions to existing panes)

`ReferralCockpitPane` (Turn 1 pane):

- Row action **"Fan out"** on rows with `status='draft'` → opens `<FanOutDialog>` (multi-target picker, engine decision preview per target, submit → `fanOut()`)
- Row action **"Accept"** on nutrition auto-referrals (`source_key LIKE 'nutrition_screen:%'` AND `status='draft'`) → runs accept flow (calls extended nutrition endpoint)

`InterCompanyReferralsPane` (Turn 1 pane):

- Row action **"Send to sibling"** on outbound-eligible rows → opens `<InterCompanyDialog>` (target entity picker from cluster members, target specialty select, submit → `interCompany()`)

`ExternalReferralsPane` (Turn 1 pane): unchanged; debt #22 banner still shown.

**New:** `SeriesBookingPane.tsx` — new tab `opd-referral-series` under Clinical group.

- Trigger: doctor selecting a pre-approved series specialty from an active encounter's context
- Form: service picker (filtered to series-eligible), session count (default 6), cadence days (default 14), first session date
- Submit → `series()` endpoint
- Renders success state showing the N booked sessions with clinic + provider
- Failure state on `not_a_series_specialty` cites debt #18 (catalog seed pending)

`RulesAdminPane` (Turn 1 pane): unchanged; write-side rule authoring stays as is.

## 5 · Tests (target ≥178; baseline 165)

- `referral-create-rules.test.ts` (5) — Rule A (other-specialty → preauth_required=true), Rule B (same-specialty ≤14 days → follow_up), Rule C boundary at day 14/day 15, Rule C series exception, Rule D dental (eligibility_check_required=true)
- `referral-fan-out.test.ts` (5) — ER fan-out creates encounter+encounter_emergency, IPD fan-out creates admission_request, EP fan-out creates electrophysiology_order, L&D fan-out links episode_of_care, OR fan-out returns 422 target_kind_not_ready (debt #46)
- `referral-fan-out-idempotency.test.ts` (2) — same `source_key` on retry returns existing target (ON CONFLICT), no duplicate rows
- `referral-inter-company.test.ts` (3) — same cluster → success, cross cluster → 403 cluster_mismatch, no cluster → 403 (from Turn 1 empty state extended to write)
- `referral-series.test.ts` (3) — 6 sessions × 14 days creates 6 clinic_bookings with matching series_id; non-series specialty → 422; idempotency via source_key
- `nutrition-accept.test.ts` (2) — accepting a draft nutrition referral runs evaluateTriggers and writes referral_target; declining sets status='declined'

**Regression:** existing 165 tests all pass. Grep gates unchanged.

## 6 · Docs + debt

`docs/his-technical-manual.md`: append "Referral write flows" documenting the fan-out target routing table, cross-encounter idempotency via source_key, inter-company cluster check, series booking mechanics.

`.lovable/plan.md`:

- **#45** → RESOLVED (referral write endpoints: create + fan-out + inter-company + series; nutrition accept extension)
- **#46** NEW — Surgery/OR referral target (`referral_target.target_kind='encounter', target_encounter_type='OR'`). Owner: **Batch C_05 OR**. Blocking: OR referral from OPD physician
- Preserve #18–#23, #22, #41–#44 with prior wording. Register single hit.

## Definition of Done

- [ ] Plan-time psql outputs pasted (referral_target.status, admission_request required cols, encounter_class enum values)
- [ ] Debt register fence landed BEFORE any migration; `## Debt Register` grep=1; **#45 RESOLVED**, **#46 opened**
- [ ] `referral.origin_source` column added (nullable, text)
- [ ] `referral_target.source_key` + UNIQUE index landed
- [ ] All 5 new write routes exist with pure-handler pattern; capIds registered in role matrix (grep 4 new capIds = 4)
- [ ] All writes call `evaluateTriggers({scope:'referral'})` — grep in each write handler = 1+
- [ ] `referral.status` uses enum values only (grep for text status literals like `'requested'|'booking'|'eligibility'|'preauth'` in new code = 0)
- [ ] Cross-encounter fan-out: ER creates encounter+encounter_emergency atomically (rollback on partial failure — fixture asserts)
- [ ] Cross-encounter fan-out: IPD creates admission_request (fixture asserts atomic)
- [ ] Cross-encounter fan-out: OR returns 422 `target_kind_not_ready` with debt #46 hint (fixture asserts)
- [ ] Inter-company: same cluster success + cross cluster 403 (fixture asserts both)
- [ ] Series: N clinic_bookings created with matching series_id (fixture asserts count + series_id uniqueness)
- [ ] Nutrition accept: extended endpoint promotes auto-generated draft → submitted + creates target (fixture asserts state transition)
- [ ] External write path still blocked (grep `referral_target.target_kind='external_facility'.*insert` in write routes = 0)
- [ ] Idempotency proven for cross-encounter (source_key retry returns existing) and series (source_key retry returns existing)
- [ ] ≥178 tests green; grep gates (raw palette, serviceClient/.from in daylight) = 0

Proceed to build.  
