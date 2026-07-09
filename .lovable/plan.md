# Step 3 · Turn 5 — Close Step 3

Finishes all Turn-4 deferrals (debt #24–#28). No new scope.

## Sequencing

### 1. Refactor 3 remaining scheduler routes

Apply Turn-4 handler pattern:

- `scheduler.booking-requests.ts` → export `handleGET({ ctx, db })`
- `scheduler.board.ts` → export `handleGET({ query, ctx, db })` (query: `day`, `clinic_id`)
- `scheduler.blocks.ts` → export `handlePOST({ body, ctx, db })`

Each with `db = serviceClient()` default. Route wrappers do auth + Zod, then delegate. No logic change; 91-test suite stays green.

### 2. Two remaining route fixtures

`**__tests__/charge-mode-display.test.ts**` — imports `handlePOST` from `../scheduler.validate-drop`, uses `_seed.ts`. Three sub-tests, fresh mock each:

- A: prior encounter 10d ago, same specialty → `charge_mode='follow_up'`
- B: 30d ago + `service_master.sub_category='series_therapy'` → `charge_mode='series'`
- C: 30d ago, no sub_category → `charge_mode='new_consult'`
All assert no 14-day bounce (display-only per DD4).

`**__tests__/booking-requests-union.test.ts**` — imports refactored `handleGET`. Seeds 3 populated clauses (referral MRN-001, cancelled+rebook_request MRN-002, marketing-unconfirmed MRN-003) + 3 exclusion controls (no_show=true, rebook_request=false, cancelled>30d). Asserts `data.length===3`, all `mrn` fields present, no excluded rows.

Target: ≥103 tests total.

### 3. Demo seed extension

Add `seedSchedulerFixtures(tenantId)` in `src/lib/demo-seed.functions.ts`, wired into `step:'data'` and `step:'all'`. Fixed UUIDs, `ON CONFLICT DO NOTHING`, idempotent.

Seeds today 08:00:

- 4 `clinic_schedule` sessions: S1 Endocrine (overbook_allowed, limit=2, rank=1), S2 OBS&GYN (female_clinic, rank=2), S3 Surgery (rank=3, one slot blocked reason `or_case`), S4 Treatment (rank=4)
- 8 `clinic_slot` rows per session (20-min slices)
- 1 `referral_target` requested, target_specialty='OBS&GYN', linked via referral→encounter→beneficiary
- 8 `clinic_bookings` across S1/S4, one per status (open/booked/confirmed/arrived/in_consult/completed/no_show/blocked)
- 1 S1 booking with `overbooked=true`

### 4. Playwright body

Complete `tests/e2e/day-board.spec.ts`. Auth via `/api/admin/v1/demo/reset` + `/seed` + `/demo-login` (matches `demo-flow.spec.ts`). `test.skip(!process.env.DEMO_USER_PASSWORD, ...)`.

7 assertion blocks:

1. Columns `[Endocrine, OBS&GYN, Surgery, Treatment]` in order
2. Now-line visible
3. All 8 `data-tone` values present
4. Walk-in lane visible
5. Rail card containing `OBS&GYN`
6. Overbook ribbon on marked slot
7. `toHaveScreenshot('day-board.png', { maxDiffPixels: 500, mask: [page.locator('[data-testid="now-line"]')] })`

Baseline committed to `tests/e2e/day-board.spec.ts-snapshots/day-board.png` via `bun test:e2e:update`.

### 5. Drag-drop UX + walk-in suggester

In `ClinicDayBoardPane.tsx`:

- `<BookingRequestCard>` draggable, sets JSON `{request_id, kind, patient_id, service_id}` via `dataTransfer`; `tabIndex={0}`, Enter opens slot picker
- `<SlotCell>` `onDrop` → `schedulerApi.validateDrop` → toast on error / overbook ribbon on `overbook_warning` / `schedulerApi.book` on ok
- `errorLabel` map covers all 8 codes
- Walk-in popover: specialty `<Select>` → `schedulerApi.board({specialty})` → top 5 open slots → same drop flow

Grep gates: `serviceClient|\.from\(` and raw `bg-emerald|bg-rose-N|bg-amber-N|bg-slate-N` in `daylight/scheduling/` → 0.

## Definition of Done

- Plan approved. Two clarifications before build: (1) `scheduler.board.ts` query field is `date` not `day` — the `handleGET({ query, ctx, db })` signature is `{ query: { date, clinic_id } }` matching the existing QuerySchema. (2) `charge-mode-display.test.ts` fixture B must seed Rule C's `pricing_rule.action` with `series_sub_category: 'series_therapy'` (Turn-1 BB2 shape), NOT `series_specialties: [...]` — otherwise foldTriggerOutcome won't match and the sub-test fails. Everything else as planned.
  **Post-build watchlist:**
  1. **Regression check** — `bun test` full suite still shows 91 pass after the 3 refactors (before adding the 2 new fixtures). This is the "no logic change" invariant. If any prior fixture fails after refactor, the refactor changed behavior.
  2. **The demo-env verification is non-optional this time.** Every prior turn we've been able to defer the visual check; this turn's DoD explicitly says "Demo env: reset→seed→`?tab=opd-day-board` shows 4 columns, 8 states, referral card, overbook ribbon." When Lovable ships, actually reset and walk it before I re-clone. If your visual check disagrees with Lovable's report, that's ground truth.
  3. **Playwright snapshot baseline needs your explicit approval before commit.** First `bun test:e2e:update` renders a baseline PNG. Open it, confirm it looks right (Endocrine leftmost, Surgery with a blocked slot, an OBS&GYN card in the rail), THEN commit. If Lovable auto-commits without you eyeballing, we lock in whatever it happened to render.
  4. 7 scheduler routes export pure handlers with `db = serviceClient()` default
- Test count ≥103, all green
- Demo env: reset→seed→`?tab=opd-day-board` shows 4 columns, 8 states, referral card, overbook ribbon
- Playwright 7 assertions pass; snapshot baseline committed
- Drag-drop, walk-in, keyboard access all working in demo env
- Grep gates: `submitEligibility`=1, `requireSupabaseAuth`=0, no `serviceClient`/`.from(` in `daylight/scheduling/`
- Debt #24–#28 removed from `.lovable/plan.md`; #18–#23 retained