## Goal

Add a Playwright end-to-end test that exercises the full demo loop — reset → seed → sign in as Tenant Admin → open the clinical Orders tab — and asserts the three demo gate fixtures render with the correct green / amber / red badges.

## Deliverable

One new spec: `tests/e2e/demo-flow.spec.ts` (create `tests/e2e/` since existing suites live under `tests/visual/`). No source changes; verification-only test.

## Test flow

1. **Reset + seed via superadmin API.**
  - Sign in as `superadmin@demo.velomedos.com` using `DEMO_USER_PASSWORD` (env), grab the Supabase access token from the session.
  - `POST /api/admin/v1/demo/reset { reseed: true }` with `Authorization: Bearer <token>`.
  - `POST /api/admin/v1/demo/seed { step: "all" }` (idempotent — safe even though reset already reseeds; guards against reset-only builds).
  - Assert 200 on both.
  - Sign out.
2. **Sign in as Tenant Admin** via `/demo-login` UI (paste shared password, click the `admin@demo.velomedos.com` card). Wait for redirect into `/clinical`.
3. **Navigate to Orders tab** — click the Orders nav item (or go to `/clinical?tab=orders` directly).
4. **Assert the three fixtures render with the expected gate states.** The demo seed produces one green (billed), one amber (released_by_exception via `emergency_override`), and one red (locked, cash_shortfall) row on the demo encounter that OrdersPane loads. Verify:
  - At least one row shows a green/OK BilledGate pill.
  - At least one row shows an amber/warn BilledGate pill (tooltip mentions release/override).
  - At least one row shows a red/crit BilledGate pill with the Perform/Dispense button disabled.
  - Assert against the `.clin-pill.ok / .warn / .crit` class markers used by the Daylight tokens.
5. **Screenshot** the OrdersPane on failure via Playwright's default `screenshot: only-on-failure`.

## Environment & config

- Read `DEMO_USER_PASSWORD` from `process.env`; `test.skip()` with a clear message when unset so CI without the secret degrades gracefully instead of red.
- Base URL comes from the existing `E2E_BASE_URL` / port-8080 defaults in `playwright.config.ts` — no config edits needed. The suite is discovered automatically because `testDir: "./tests"` already sweeps subfolders.
- Single `chromium` project (matches existing suites).

## Technical notes (for reviewer)

- OrdersPane loads the most recent encounter for the signed-in tenant; the demo fixtures migration (`20260706174754_*`) seeds three encounters in that tenant. The test asserts colors are all present in the union across rendered rows rather than binding to a specific row order — resilient to `listCharges` sort order.
- Uses `page.request` for the two admin POSTs (after logging in via UI once to mint the token), or alternatively calls `supabase.auth.signInWithPassword` in a `page.evaluate` and extracts the access token from `localStorage`. Prefer the latter to keep the login-UI assertion in one dedicated place.
- Test is tagged `@demo-flow` and placed under `tests/e2e/` so `bunx playwright test tests/e2e` runs it in isolation.

## Out of scope

- No changes to seed logic, OrdersPane, or the demo login page.
- No new CI wiring; the test runs on demand via `bunx playwright test`.
- No coverage of Results tab (Step 2 will extend once its fixtures land).  
  
Approved with amendments: (1) the "no seed changes" constraint is lifted — add `seedGateFixtures()` to `demo-seed.functions.ts` (step data/all, fixed UUIDs, ON CONFLICT DO NOTHING) because demo reset deletes encounter/charge_item and migration-seeded fixtures never return; (2) consolidate the three states onto ONE most-recent EMER encounter `ENC-DEMO-GATE` — green = insured charge with approved authorization_item, amber = insured charge with a CHARGE-SCOPED emergency_override (charge_item_id set, encounter_id NULL — encounter-level would release everything), red = unpaid cash charge — because OrdersPane renders a single encounter; (3) remove "cash_shortfall" — locked rows have NULL reason_code; (4) assert disabled state via the BilledGate wrapper's aria-disabled, not button disabled. Everything else as planned.