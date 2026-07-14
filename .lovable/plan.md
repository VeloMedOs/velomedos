# Governance Round 2 — RufayQ Mirror + Landing Rewrite + Audit Fixes

## RufayQ post-clone summary (confirmation before commit)

Cloned github.com/RufayQ/rufayq. Pricing lives in `supabase/migrations/20260429114516_...sql` (230 LOC). Key facts ApplicationPMO must validate:

### 6 tables (not 7 — RufayQ has no "bundle" table)


| Table                     | Cols (domain)                                                                                                              | Notes                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `pricing_plans`           | code UNIQUE, name_en, name_ar, description_en/ar, recommended, sort_order, is_active, cta_en/ar, published_at              | Header                 |
| `pricing_plan_features`   | plan_id FK CASCADE, text_en, text_ar, sort_order                                                                           | Idx on plan_id         |
| `pricing_plan_prices`     | plan_id, currency, billing_cycle CHECK IN (monthly/quarterly/yearly), amount NUMERIC(12,2), UNIQUE(plan_id,currency,cycle) | Multi-currency × cycle |
| `pricing_addons`          | key UNIQUE, name_en/ar, description_en/ar, unit_en/ar, cta_en/ar, hero bool, is_active, sort_order                         | &nbsp;                 |
| `pricing_addon_prices`    | addon_id, currency, amount NUMERIC(12,2), UNIQUE(addon_id,currency)                                                        | No cycle — flat        |
| `pricing_catalog_version` | id INT PK CHECK id=1, version BIGINT, updated_at                                                                           | Singleton row          |


### Trigger

`bump_pricing_catalog_version()` — SECURITY DEFINER, `search_path=public`, AFTER INSERT/UPDATE/DELETE on all 5 catalog tables. Increments singleton version, logs to `log_audit_event`. Returns `COALESCE(NEW,OLD)`.

### RLS pattern

Anon SELECT gated on `is_active=true` (or parent `is_active`). Authenticated moderator/admin SELECT all. Admin FOR ALL with `has_role`. `pricing_catalog_version`: public SELECT true, admin UPDATE.

### Realtime

`ALTER PUBLICATION supabase_realtime ADD TABLE public.pricing_catalog_version;` — public site channel subscribes to postgres_changes UPDATE.

### Hook shape (`usePricingCatalog`)

Returns `{plans, addons, loading, error, reload}`. Camel-cased DTOs (`nameEn`, `sortOrder`). 5 parallel `.select("*")` calls, filters on `is_active=true` for public surfaces. Realtime channel `pricing-catalog-version` triggers refetch via `setTick`.

### Admin UI

`AdminPricingCatalog.tsx` — 3 tabs (Plans/Add-ons/History), `usePermissions().can("pricing.modify")` gate, dark + gold, tier card grid, "+ New plan" affordance, Reload button, sonner toasts. History tab filters `audit_log` for `pricing_*` events.

### VeloMed adjustments (schema deltas)

- **Table prefix:** `platform_pricing_*` (VeloMed already has RCM `price_list*` for hospital billing catalog — different concern; rename to avoid collision).
- `**platform_pricing_plans` additions:** `included_modules TEXT[]`, `max_beds INT NULL`, `max_users INT NULL`.
- `**platform_pricing_addons` addition:** `entitlement_flag TEXT` (e.g. `whitelabel`, `custom_domain`, `email_identity`).
- `**bundle` table not carried over** — not in RufayQ, not in Call C spec.
- **VeloMed existing skeletons** (`subscription_plans`, `subscription_addons`, `tenant_subscriptions`) are drop-and-replace in Batch 1: they lack bilingual, multi-currency, version-bump, and are unwired. New tables supersede.
- **GRANT block** added per VeloMed convention (RufayQ omits explicit GRANTs; VeloMed requires them for every public-schema table).
- `**has_role` reuse:** VeloMed's existing `has_role(_, 'superadmin')` gates admin writes; `has_role(_, 'admin')` for moderator equivalent.

---

## Batch 1 — Schema + Landing Rewrite (single turn)

Landing rewrite ships WITH schema — no intermediate "admin edits go to a DB nobody reads" state.

### 1.1 Migration (one file)

Tables: `platform_pricing_plans`, `platform_pricing_plan_features`, `platform_pricing_plan_prices`, `platform_pricing_addons`, `platform_pricing_addon_prices`, `platform_pricing_catalog_version` — mirroring RufayQ shape + VeloMed deltas above.

Subscription tables: `tenant_subscription` (tenant_id, plan_id FK, status, billing_cycle, currency, activated_at, expires_at, cancelled_at), `tenant_subscription_addon` (subscription_id, addon_id, quantity, activated_at), `subscription_event` (subscription_id, event_type, actor_id, payload jsonb).

Drop skeleton tables `subscription_plans`, `subscription_addons`, `tenant_subscriptions` (empty per DB inspection; superseded).

Function `bump_platform_pricing_catalog_version()` — mirrored, SECURITY DEFINER, search_path=public.

Function `is_addon_enabled(_tenant_id UUID, _entitlement_flag TEXT)` — returns bool; SECURITY DEFINER; joins tenant_subscription → tenant_subscription_addon → platform_pricing_addons on entitlement_flag; returns true if active row exists.

Triggers: 5 catalog-table AFTER I/U/D → bump_platform_pricing_catalog_version; updated_at triggers on all.

RLS: anon SELECT on active rows; superadmin FOR ALL. Explicit GRANT block per convention:

```sql
GRANT SELECT ON public.platform_pricing_* TO anon, authenticated;
GRANT ALL   ON public.platform_pricing_* TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_subscription* TO authenticated;
GRANT ALL ON public.tenant_subscription* TO service_role;
```

Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_pricing_catalog_version;`

REVOKE EXECUTE on `bump_platform_pricing_catalog_version` and `is_addon_enabled` from PUBLIC/anon/authenticated (per D4 hardening pattern already applied Round 1).

Seed 4 tiers (Free/Starter/Companion/Enterprise), Call C entitlement add-ons (whitelabel, custom_domain, email_identity), SAR/USD/EUR prices.

### 1.2 Public catalog server route

`src/routes/api/public/v1/pricing-catalog.ts` — GET; uses server publishable client (anon SELECT policy); returns `{plans, addons, version}`. Cache-Control: `s-maxage=60, stale-while-revalidate=300`.

### 1.3 Hook `src/hooks/usePricingCatalog.ts`

Mirrors RufayQ signature exactly. Reads directly from `supabase` client. Realtime channel `platform-pricing-catalog-version` subscribes to postgres_changes UPDATE on version table → `setTick` → refetch.

### 1.4 Landing rewrite `src/routes/index.tsx`

Consumes `usePricingCatalog()`. Removes every hardcoded plan/tier/price/feature literal. Add-ons rendered from `addons` array. Currency selector wired to prices. Zero fallback string literals — if catalog fails, error boundary shows "Pricing temporarily unavailable" (single string, no prices).

### 1.5 Fixtures (Batch 1)

- `landing-hardcoded-prices.test.ts` — greps `src/routes/index.tsx` for SAR/USD/EUR numeric literals; **asserts count === 0**.
- `pricing-catalog-version-bump.test.ts` — inserts `platform_pricing_plans` row via `supabaseAdmin`; asserts `platform_pricing_catalog_version.version` incremented.
- `pricing-catalog-realtime.test.ts` — opens channel, mutates a plan, asserts postgres_changes payload received within 2000ms (end-to-end proof, addresses W2).
- `is-addon-enabled.test.ts` — asserts function returns true only when tenant has active subscription with matching entitlement addon.
- `pricing-catalog-public-endpoint.test.ts` — anon fetch returns active rows only; inactive rows filtered.

Target: **~229 tests total** (224 + 5).

### 1.6 Debt register updates (append to plan.md end, per Convention #25)

Close row on RufayQ-pattern implementation. No new debt.

---

## Batch 2 — Admin UI + Subscription UI + Audit Fixes (single turn, after Batch 1 approval)

### 2.1 `AdminPricingCatalog.tsx`

Mirror RufayQ layout exactly. 3 tabs: Plans / Add-ons / History. Dark + gold accent (map to VeloMed Daylight tokens; teal/coral not gold — clarify with PMO if strict gold required). Tier card grid, "N features · SAR X / mo" chip, "+ New plan", Reload button, sonner toasts. History tab reads audit trail. Mounted at `/superadmin/pricing-catalog`. `requireSuperadmin` gate.

### 2.2 `AdminSubscriptions.tsx`

Superadmin surface for `tenant_subscription` — list tenants, assign/change plan, add/remove addons, view `subscription_event` timeline. Mounted at `/superadmin/subscriptions`.

### 2.3 Absorb Demo Security Audit findings

**D1 (dead code):** Delete `AUTOFILL_KEY` localStorage block in `src/routes/demo-login.tsx` (~20 LOC). No behavior change.

**D2 (prom_response cross-tenant):** Drop `_superadmin` SELECT policy on `prom_response` (and `prem_response`, `prom_assignment` if same pattern). Collapse policies to `is_tenant_member`. Add `src/lib/ops/prom.functions.ts` → `listPromResponsesCrossTenant` server fn: `requireSupabaseAuth` + `has_role(superadmin)` AND `NOT is_sandbox_tenant(tenant_id)` per-row filter, uses `supabaseAdmin` (loaded inside handler). Wire existing superadmin PROM viewer to new fn.

**D3 (reveal-off session fan-out):** Refactor `setDemoPublicReveal` in `src/lib/demo-credentials.functions.ts` — when flipping to false, enumerate `tenant_members` where tenant is demo sandbox, batch-call `supabaseAdmin.auth.admin.signOut(userId)` per user. Test asserts signOut called for each demo user.

**D4 (SECURITY DEFINER audit):** Enumerate all `SECURITY DEFINER` fns in `public`. Produce `docs/security/security-definer-audit-2026-07.md` — for each: caller, capability check, EXECUTE grantees. Fix any missing internal check by revoking EXECUTE from anon/authenticated (mirror RufayQ's `20260513190016_*.sql` pattern: array-of-signatures REVOKE loop).

### 2.4 Fixtures (Batch 2)

- Pricing CRUD (create plan → feature → price → assert catalog version bumps 3×).
- Admin UI smoke (Playwright): open 3 tabs, create plan, verify landing refreshes within 2s.
- D2: sandbox superadmin sees empty prom_response; real-tenant superadmin sees results via Ops fn.
- D3: `signOut` mock called N times where N = demo tenant member count.
- D4: no undocumented SECURITY DEFINER fn executable by anon/authenticated.

Target: ~245 tests total.

### 2.5 Debt register updates

Close #49 (audit findings absorbed). Append row: `#51 SECURITY DEFINER audit complete — see docs/security/security-definer-audit-2026-07.md`.

---

## Watchlist alignment (ApplicationPMO's two flags)

1. **Landing rewrite in Batch 1.** ✅ Section 1.4 ships with schema. No intermediate state.
2. **Realtime E2E proof.** ✅ Section 1.5 includes `pricing-catalog-realtime.test.ts` — mutates plan, asserts subscriber receives postgres_changes payload within 2000ms.

## Open clarifications (non-blocking; will proceed with defaults if unanswered)

1. **Gold accent vs VeloMed teal/coral.** RufayQ uses dark + gold. VeloMed core memory is teal/coral/blue Apple-minimal. Default: use VeloMed tokens (teal for recommended tier, coral for CTAs) rather than importing gold. If strict RufayQ visual mirror required, say so before Batch 2.
2. **Bundle table.** Not in RufayQ, not in Call C. Skipping. Confirm.
3. **Table prefix.** Using `platform_pricing_*` to avoid RCM `price_list*` collision. Confirm.  
  
**Two things worth naming — one important architectural nudge, one clarification:**
  **AAB1 — The** `log_audit_event` **dependency.** RufayQ's `bump_pricing_catalog_version()` calls `PERFORM public.log_audit_event(...)` inside the trigger. That function may not exist in VeloMed's schema. Two paths:
  - **(a) Skip the audit call.** Simpler; `bump_platform_pricing_catalog_version()` just updates the singleton, doesn't log. VeloMed's `admin_audit_log` or whatever equivalent tracks changes via other mechanism (superadmin route audit, etc.).
  - **(b) Port** `log_audit_event` **first.** Adds a dependency; increases migration surface.
  **Recommend (a) — skip the audit call.** VeloMed has route-level audit logging (per Convention #33 sandbox gates); pricing catalog changes go through superadmin routes that will log via existing mechanisms. Duplicating audit at both trigger and route is over-logging. Round 2's `AdminPricingCatalog` History tab (Batch 2) can read the route-level audit if VeloMed has one, or filter `superadmin_audit_log` for `pricing_*` action types. Confirm VeloMed's audit mechanism before Batch 1 commits.
  **AAB2 — The three "Open clarifications" Lovable listed.** All three need explicit answers before Batch 1 builds:
  1. **Gold accent vs VeloMed teal/coral.** Lovable's default is right — use VeloMed Daylight tokens (`.clin-*`, teal for recommended tier, coral for CTAs). Cloning RufayQ's *dark+gold* visual would violate the Daylight theme convention locked in Step 2. **Clone the UX pattern (3 tabs, tier grid, feature chips, "+New plan"), not the color palette.** Confirmed.
  2. **Bundle table skipped.** Correct — not in RufayQ, not in Call C, no VeloMed need surfaces. Confirmed skip.
  3. **Table prefix** `platform_pricing_*`**.** Correct — VeloMed has `price_list*` for hospital RCM pricing (charge-item pricing, payer contracts) which is genuinely different from platform subscription pricing. Namespace separation prevents drift. Confirmed.
  **Two more small tightenings:**
  **AAB3 —** `is_addon_enabled()` **gates:** plan says "SECURITY DEFINER; joins tenant_subscription → tenant_subscription_addon → platform_pricing_addons on entitlement_flag." Must specify: (a) only rows where `tenant_subscription.status='active'`, (b) `tenant_subscription_addon.activated_at IS NOT NULL AND cancelled_at IS NULL`. Otherwise a cancelled add-on still returns true.
  **AAB4 — Drop the skeleton tables safely.** Plan says "Drop skeleton tables `subscription_plans`, `subscription_addons`, `tenant_subscriptions` (empty per DB inspection)." Verify emptiness at migration time — if any row exists (perhaps seeded in a dev branch, or a fixture inserted for testing), the DROP fails or silently loses data. Add a safety guard:
  sql
  ```sql
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM public.subscription_plans LIMIT 1) THEN
      RAISE EXCEPTION 'subscription_plans has rows; drop unsafe. Archive first.';
    END IF;
  END $$;
  DROP TABLE IF EXISTS public.subscription_plans CASCADE;
  ```
  Same guard on the other two.
  **Also verified:** landing-hardcoded-prices fixture is the right guard (Convention #32-style grep test proving the wire-through), realtime E2E fixture with 2000ms threshold is realistic, target ~229 tests is arithmetic-consistent with 224 baseline + 5 new.
  **Reply to Lovable:**
  > Plan verified against fresh RufayQ clone — 6 tables (not 7, my earlier prompt was wrong; you caught it), `pricing_plans` column list byte-exact, `bump_pricing_catalog_version()` definition + 5 trigger attachments verified via grep, realtime publication ADD at line 230 confirmed, hook signature matches, REVOKE pattern from `20260513190016` is the right D4 template. Four tightenings before Batch 1 commits:
  >
  > **1.** `log_audit_event` **dependency handling.** RufayQ's bump trigger calls `PERFORM public.log_audit_event(...)` inside. This function may not exist in VeloMed. Skip the audit call — `bump_platform_pricing_catalog_version()` just updates the singleton, doesn't log. Pricing catalog changes flow through superadmin routes which log via existing route-level audit mechanism (Convention #33 sandbox gates, existing admin audit tables). Duplicating at both trigger and route is over-logging. Batch 2's History tab reads whatever admin audit table VeloMed already uses — please confirm which one by grep before Batch 2 planning.
  >
  > **2.** `is_addon_enabled()` **filters.** Must specify both: `tenant_subscription.status='active'` AND `tenant_subscription_addon.activated_at IS NOT NULL AND cancelled_at IS NULL`. Otherwise a cancelled add-on returns true. Fixture `is-addon-enabled.test.ts` should include a "cancelled addon returns false" assertion explicitly.
  >
  > **3. Safety guard on DROP.** For `subscription_plans`, `subscription_addons`, `tenant_subscriptions` drops — even though inspection says empty, add DO block that raises exception if any row exists:
  >
  > sql
  >
  > ```sql
  > DO $$ BEGIN
  >   IF EXISTS (SELECT 1 FROM public.subscription_plans LIMIT 1) THEN
  >     RAISE EXCEPTION 'subscription_plans has rows; drop unsafe. Archive first.';
  >   END IF;
  > END $$;
  > DROP TABLE IF EXISTS public.subscription_plans CASCADE;
  > ```
  >
  > Same guard on the other two. Belt-and-suspenders — inspection may have been done on a stale branch.
  >
  > **4. Three "Open clarifications" answered:**
  >
  > - **Gold accent:** use VeloMed Daylight tokens (teal for recommended, coral for CTAs). Clone RufayQ's UX pattern (3 tabs, tier grid, feature chips, "+New plan", Reload) not the color palette. Daylight is locked convention.
  > - **Bundle table:** skip confirmed. Not in RufayQ, not in Call C.
  > - **Table prefix** `platform_pricing_*`**:** confirmed. Separates platform-subscription pricing from RCM hospital-billing pricing (`price_list*`).
  >
  > Landing rewrite in Batch 1 confirmed correct scope. Realtime E2E fixture is the right end-to-end proof. `landing-hardcoded-prices.test.ts` greps zero SAR/USD/EUR numeric literals in `src/routes/index.tsx` — good permanent guard for the "landing must consume DB" contract.
  >
  > Proceed to Batch 1 build. Ship report with fresh commit hash for validation.
  ### Post-build watchlist
  When Batch 1 lands:
  1. **Migration count** — one migration file (per plan), all 6 tables + 3 subscription tables + 2 fns + 5 triggers + RLS + GRANTs + REVOKE + realtime + seed data. Verify single-file discipline held.
  2. `bump_platform_pricing_catalog_version()` **does NOT call** `log_audit_event` — grep the fn body for `log_audit_event` = 0 hits.
  3. **Landing zero hardcoded prices** — the fixture proves this; also spot-check `src/routes/index.tsx` visually for tier metadata.
  4. **Realtime end-to-end works** — the 2000ms fixture must run against a real DB channel, not a mock. If Lovable stubs it, flag the stub.
  5. `is_addon_enabled` **cancelled-addon fixture** — explicitly asserts false for cancelled state.
  6. **Skeleton table safety guard** landed as-written.
  7. **Register single hit + row-delta only** — Convention #25.
  8. **Filename ↔ createFileRoute discipline** — the new `pricing-catalog.ts` public route must match its filename-derived URL exactly.