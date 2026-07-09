# VeloMed Mini-HIS — Technical Manual

## Access entry architecture (v2)

- **Single door:** every human signs in through `/auth`. Search-param `next` is validated by `z.string().regex(/^\/(?![\/\\])/)`, which rejects absolute URLs, protocol-relative `//evil` and backslash `/\evil` bait. `next` is *honoured only when authorised* — both `auth.tsx` and the launcher resolve the user's allow-set via `resolveDestination()` in `src/lib/launch-destination.ts` and drop unauthorised targets silently.
- **Launcher (`/launch`):** `src/routes/_authenticated/launch.tsx`. Loads platform roles from `user_roles` and the active tenant's `clinical_role` from `tenant_members` in parallel. Single-destination → auto-redirect; multi-destination → card launcher. Multi-tenant users see a picker; choice persists in `localStorage('velomed.active_tenant')` and is mirrored to the `x-tenant-id` header for downstream clinical calls.
- **Deep link (`/his`):** public route. Authed → `/launch`; unauthed → `/auth?next=/launch`. Surfaced from `SiteChrome` as the discreet "Staff login" link.
- **Unified `/clinical` workspace:** supersedes the Phase-8 "clinical tabs inside provider.tsx/admin.tsx". The HIS workspace shell at `src/routes/_authenticated/clinical.tsx` filters its left rail with `modulesForRole(role)`; `read_only` gets every module (view-only badge). `provider.tsx` and `admin.tsx` keep their non-HIS surfaces and link out.

## Documentation hub

- **Read path:** bundled. `src/lib/his-docs.ts` is the *single* module that does the Vite `?raw` imports for `docs/*.md`. The Superadmin Docs UI and the API both read from this manifest — no deep relative `?raw` imports inside `src/routes/api/clinical/v1/docs/*`.
- **API:** `GET /api/clinical/v1/docs` (manifest), `GET /api/clinical/v1/docs/{slug}` (full markdown), `GET /api/clinical/v1/docs/{slug}/{module}` (slice by `## <module>` heading). `PUT /api/clinical/v1/docs/{slug}` is guarded by `requireClinicalModule(req, "Documentation", { capId: "docs.write" })` and currently returns 501 — the DB-overlay write path (`his_doc` table) is on the roadmap.
- **UI:** `src/components/superadmin/DocsPane.tsx` (embedded in Superadmin → Documentation tab, also reachable at `/superadmin/docs`). Uses `react-markdown` + `remark-gfm`, builds a sticky TOC from `##` / `###` headings, supports section filter and `.md` download.

## Per-module API guards

`src/lib/api-clinical.ts` is the SSOT for HIS/RCM authorization. The model is **read-permissive, write-gated**:

- `requireTenant(request)` — any authenticated tenant member; `tenant_admin` is implicitly allowed everywhere downstream.
- `requireClinicalRead(request, module)` — GETs only; throws in dev if called on a write method.
- `requireClinicalWrite(request, module, { capId? })` — writes; requires an action capability in the module (or specifically `capId` when supplied). `read_only` is rejected.
- `requireClinicalModule(request, module, { capId? })` (also exported as `requireModule`) — dispatches read vs write by HTTP method.
- **Sensitive overrides:** `READ_GATED_MODULES = { "Cash & ZATCA" }` and `READ_GATED_CAPS = { "claim.post", "dep.approve" }` — these require the capability even for GET.

Existing routes that use `requireClinicalRole(roles)` continue to work; new routes should prefer `requireModule(request, module)` to stay matrix-driven.

## DB alignment

`clinical_role` enum holds all 17 values from `ClinicalRole` (verified via `enum_range`). No migration required for this release.

## Phase 6 — Coding + AR-DRG Grouper

### Data model

- **`clinical_coding`** — one row per encounter (`UNIQUE encounter_id`). Fields: `coder_id`, `status (in_progress|coded|amended)`, `principal_diagnosis_id` → `encounter_diagnosis`, `coded_at`, `notes`. Trigger: when `status='coded'` → `encounter_advance_journey(encounter_id,'coded')`.
- **`drg_assignment`** — historical, one `assigned` per encounter (partial unique index). Fields: `drg_id` (NULLABLE FK → `drg`), `drg_code` + `drg_version` (snapshot, always required), `mdc`, `adrg`, `partition`, `complexity_score`, `grouper_name`, `grouper_version`, `grouper_request` (jsonb), `grouper_response` (jsonb), `assigned_at`, `status (assigned|superseded)`. Triggers: BEFORE INSERT supersedes any prior `assigned` for the same encounter; AFTER INSERT advances journey to `grouped`.

### Grouper MDS input contract (`buildGrouperMds`)

| Field | Source |
|---|---|
| principal_diagnosis (ICD-10-AM) + POA | `encounter_diagnosis` where `role='principal'` |
| additional_diagnoses[] + POA | remaining `encounter_diagnosis` rows |
| procedures (ACHI) | `charge_item.achi_code` (distinct) for the encounter |
| age_years / age_days | computed at `encounter_hospitalization.admitted_at − beneficiary.dob` |
| sex | `beneficiary.gender` |
| los_days | `encounter_hospitalization.length_of_stay_days` |
| same_day, mechanical_ventilation_hours, separation_mode | `encounter` |
| birth_weight_grams | `beneficiary.birth_weight_grams` |

### External grouper

- Env: `GROUPER_ENDPOINT`, `GROUPER_API_KEY` (read at call time inside `callGrouper`).
- Request: `POST { …GrouperMds }` with `Authorization: Bearer …` when key set.
- Response (normalised): `{ drg_code, drg_version, mdc, adrg, partition, complexity_score, grouper_name, grouper_version }`.
- When `GROUPER_ENDPOINT` is unset, a deterministic stub returns `F62B / AR-DRG v9.0 / MDC 05`.
- **No grouping logic is implemented in-house** (licensed). We only assemble inputs and store the returned DRG.

### `drg_id` binding

After grouper response, we best-effort lookup `drg` by `(drg_code, version)`. If unmatched (e.g. reference catalogue not loaded), we still INSERT with `drg_id = NULL`. The `drg_code` + `drg_version` snapshot is the source of truth for downstream pricing.

### Routes

- `GET /api/clinical/v1/encounters/:id/code` — current coding row.
- `POST /api/clinical/v1/encounters/:id/code` — finalize; requires class=IMP, journey ≥ `discharged`, encounter has principal Dx, `principal_diagnosis_id` matches.
- `POST /api/clinical/v1/encounters/:id/group` — run grouper; requires class=IMP, journey ≥ `coded`. Idempotent unless `{ force: true }`.
- `GET /api/clinical/v1/encounters/:id/drg` — current assignment + history.
## Phase 8 — Portal architecture

### Surfaces
- `/clinical` (`src/routes/_authenticated/clinical.tsx`) — provider HIS workspace.
- `/clinical-masters` (`src/routes/_authenticated/clinical-masters.tsx`) — tenant_admin masters CRUD.
- `/clinical-superadmin` (`src/routes/_authenticated/clinical-superadmin.tsx`) — superadmin cross-tenant claims (direct Supabase read; gated by `user_roles.role = 'superadmin'`).

### Shared
- `src/lib/clinical-api.ts` — `clinicalFetch<T>` + `ClinicalAPI.*` typed wrappers. Injects Supabase bearer; supports `x-tenant-id` header. Throws `ClinicalApiError(message, status, code, payload)` on non-2xx.
- `src/lib/clinical-roles.ts` — `useClinicalMe()` reads `GET /api/clinical/v1/me`; `canAct(me, allowed)` returns true for the requested clinical roles or `tenant_admin`.

### Security boundary (do not misread)
UI role-gating in `clinical.tsx` and disabled buttons in `clinical-masters.tsx` are **UX only**. The authorization boundary is the server: every `/api/clinical/v1/*` route uses `requireClinicalRole` or `requireTenant`. A hidden action still 403s if invoked directly.

### New endpoint
- `GET /api/clinical/v1/me` → `{ data: { user_id, tenant_id, role, clinical_role } }`. Requires bearer; otherwise standard envelope.

## Clinic Day Board (Batch C_10 pattern)

Step 3 · Turn 2/3 ships the OPD Clinic Day Board as the primary booking
surface. It is built on a **generic** `<DayBoard />` component
(`src/components/clinical/daylight/scheduling/DayBoard.tsx`) which Batch C
OR/Cath will re-configure — no OPD literals live in the component.

### `SuiteConfig<TSlot, TBooking>` contract

| Field | Purpose |
|-------|---------|
| `suite` | Identity string; rendered as `data-suite` and aria-label. |
| `columns` | Session metadata (provider × room × badges). |
| `timeTicks` | ISO instants used as row axis (default 20-min grid). |
| `slotsBySession` | Slot rows keyed by `session_id`. |
| `bookingsBySlot` | Booking keyed by `slot_id` (nullable). |
| `columnSort` | Comparator — OPD uses `columnSort` from `src/lib/rcm/scheduler.ts`. |
| `columnBadges` | Chips displayed in the session header. |
| `slotColor` | Maps slot + booking → one of 8 state tones. |
| `renderSlot` (optional) | Renders the slot cell body; charge_mode chip lives here. |

### HCA-0050 column ordering

Columns sort by `priority_rank ASC NULLS LAST`, then
`providers.display_name ASC` (locale-aware). The comparator is exported
from `src/lib/rcm/scheduler.ts` and covered by `scheduler.test.ts`. Any
pane using the board **must** cite HCA-0050 in a comment above the call
site — the sort is user-visible spec behaviour, not implementation
detail.

### Atomic held-slot claim

`validate-drop` and `bookings/:id/book` both use `UPDATE … WHERE
status='held' AND held_until > now() RETURNING id` in a single statement
instead of a `SELECT` followed by `UPDATE`. Postgres executes the
`UPDATE` under row lock, so exactly one concurrent caller sees a
non-empty `RETURNING`; the loser bounces with `SLOT_UNAVAILABLE` (or
`SLOT_JUST_TAKEN` during hold acquisition). Never split this into two
statements — the race window between `SELECT` and `UPDATE` is where
double-books were born.

### Post-book eligibility flow (DD6)

1. `validate-drop` writes `eligibility_check_pending = booking.coverage_id IS NOT NULL`.
2. `book` commits the held slot; the booking is `requested`.
3. `bookings/:id/eligibility-check` is the **only** scheduling caller of
   the NPHIES eligibility engine. It clears
   `eligibility_check_pending`.
4. `bookings/:id/status` refuses `status='confirmed'` while
   `eligibility_check_pending=true` and returns
   `BOOKING_CONFIRM_ELIGIBILITY_PENDING` (409) — mirrors the DB trigger
   for a clean UI error.

### DD4 — Rule B/C is DISPLAY-only

The 14-day repeat rule (Rules B/C) **does not bounce** a drop. Instead,
`evaluateTriggers` runs during `validate-drop` and its outcome is
folded into `clinic_bookings.charge_mode`. The UI renders it as a
yellow `.clin-pill.warn` chip. `SLOT_REPEAT_BLOCK_14D` is intentionally
absent from `SCHEDULER_ERROR`.

### DD5 — overbook two paths

| Situation | Response |
|-----------|----------|
| below `capacity` | `{ok:true, overbook_warning:false}` |
| at capacity but below `capacity+overbook_limit`, `overbook_allowed`, caller has `scheduler.overbook` | `{ok:true, overbook_warning:true}` + booking stamped `overbooked=true`; UI shows yellow ⚠ ribbon |
| past `capacity+overbook_limit`, or missing the privilege, or the schedule disallows overbook | `bounce('SLOT_CAPACITY_FULL')` (422) |

### Visual test updates ritual

1. Run `bun run test:e2e:update` **only** after a screenshot regression
   you can explain (spec change, token change, new chip). Never blanket
   the whole suite.
2. Review the pixel diff in `git diff --stat 'tests/**/*.png'`. The diff
   must match the source change — a text edit should not move a
   sidebar.
3. Commit the new baseline in the **same** PR as the source change so
   reviewers can verify the intent.
4. **Never** update snapshots to hide a regression. If the diff surprises
   you, roll back the source change instead.

---

## OPD Cross-Module Gate (E16) — Step 4 Turn 1 wiring reference

**Predicate.** An OPD visit becomes billable only when the encounter has a
valid `episode_of_care` context (implicit for outpatient) AND every ordered
`charge_item` clears the two-layer gate: **forms gate → billed gate**. The
SQL trigger `charge_is_billed()` is the enforcing edge; UI `<BilledGate>`
wrappers and API 4xx envelopes are UX/API mirrors that must never diverge.

**Three layers, one order.**

| Layer | Enforcement | Blocking? |
|-------|-------------|-----------|
| 1 · Registration eligibility | `POST /opd/registration/eligibility-first` (HCA-0065) | Yes (422/403) |
| 2 · Forms gate | `v_order_item_gate` + `order_item_perform_guard` trigger | Yes (locked state) |
| 3 · Billed gate | `charge_is_billed()` trigger + `<BilledGate>` UX | Yes (Perform disabled) |

**Six touch points.**

1. Registration: eligibility-first BEFORE visit-create. Coverage card sits
   above Contact in `RegistrationPane`.
2. Pregnancy episode linking: `POST /opd/pregnancy-episode/link` runs on
   encounter-create when specialty is OBS&GYN. Idempotent.
3. Order Profile Billed Status column (HCA-0250/0251) presents
   `v_order_item_gate.gate_state` as Paid/Unpaid — same pill across every
   order group.
4. Scheduler drop-validate surfaces `anc_cadence_suggestion` when the
   beneficiary has an active `care_type='pregnancy'` episode and the
   target schedule is OBS&GYN. Advisory only — never bounces.
5. Patient banner shows a pulsing pregnancy pill (`animate-pulse`) when
   an active pregnancy episode exists.
6. Refund → Unpaid re-lock: the trigger revokes billed status when
   `charge_item.status` returns to unpaid, flowing back through
   `<BilledGate>` without any client work.

**Eligibility-check self-pay mutation warning.**
`POST /api/clinical/v1/eligibility/check` is state-mutating: when
`coverage_id` is omitted it immediately transitions the visit to
`self_pay`. Only call it with a real `coverage_id`. For the pre-visit
gate, use `/opd/registration/eligibility-first` (self-pay is decided by
`financial_type` alone, never by an eligibility probe).

**Column-name overrides (verified at plan-time).**

| Table | Correct column | Common miswrite |
|-------|---------------|-----------------|
| `episode_of_care` | `care_type`, `end_date` | `type`, `expected_end` |
| `clinic_bookings` | `origin_encounter_id` (already exists) | `parent_encounter_id` |
| `service_master` | `execution_venue` (now CHECK-constrained) | `venue` |

## Maternity OPD banner deltas (D2/D4/D6/D7) — Step 4 · Turn 4

- **Active pregnancy view** — `v_pregnancy_episode_active` projects `edd_computed = start_date + 280`, `weeks_gestation`, and `cadence_band ∈ {Q4W,Q2W,Q1W}` (thresholds: <196d, <252d, else). Literal cadence pending debt #21 (`maternity_protocol.next_anc_due_at`).
- **Protocol resolver** — `resolve_maternity_protocol(_tenant, _encounter)` joins `encounter → coverage → maternity_protocol` on `payer_id` and (when configured) `policy_id`, preferring the policy-specific match. `coverage` has no `class_id`; class-based scoping deferred.
- **Banner deltas** — `PatientBanner` renders D2 protocol hyperlink chip, D6 ANC cadence chip, D4 sibling-visit counter (tenant-local only — no cross-tenant surface).
- **D7 chart close** — `DeliveryOutcomeDialog` → `opd.maternity.deliveryClose` sets `episode_of_care.status='delivered' + end_date`. Idempotent.

## Nutrition auto-referral (HCA-0255) — Step 4 · Turn 4

- **Primary trigger is nursing screening form score**, not vitals. `v_opd_nutrition_referral_candidate` picks encounters with an active pregnancy episode + submitted `NUTRITION_SCREEN_ANC` form whose `answers ->> 'risk_score' IN ('moderate','high')`.
- `tg_encounter_nutrition_referral` fires `AFTER INSERT OR UPDATE OF journey_state ... WHEN (NEW.journey_state='encounter_open')`, inserts a `referral` row (`status='draft'`, `reason='nutrition_high_risk_pregnancy'`, `source_specialty='nutrition'`), and dedupes via `source_key='nutrition_screen:<encounter_uuid>'` unique index. Referral routing (target selection) stays with the Step 5 cockpit.
- Seed `NUTRITION_CONSULT` service_master (`service_type='services'`, `billing_type='on_raising'`).
