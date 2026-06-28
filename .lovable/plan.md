## 1. Plans vs Subscriptions — merge

**Difference today**

- **Plans** = the catalog (Starter / Operator / Network / Sovereign) — pricing, included seats, features. Editable templates.
- **Subscriptions** = a tenant=Businesses's assignment of a plan (status, seats, renew_at, billing).
- &nbsp;

They are related but not the same. The fix is not to delete one — it's to stop showing them as two top-level entries. They will live under one **Subscriptions** module with two sub-tabs.

**Side nav change** (`src/components/superadmin/SideNav.tsx`)

- Revenue group becomes:
  - **Subscriptions** (parent)
    - Active subscriptions
    - Plans & pricing
    - Add-ons
  - **Financials** (new — see §3)
  - Refunds (soon)
- Drop the standalone `plans` item.

**Superadmin page** (`src/routes/_authenticated/superadmin.tsx`)

- New `SubscriptionsPane` wrapping internal tabs: `Subscriptions | Plans | Add-ons`, reusing existing `SubsPane` and `PlansPane` and adding an `AddonsPane`.
- Old `tab === "plans"` route stays valid (deep links) but renders inside the new pane with the Plans sub-tab pre-selected.

## 2. Wire pricing + add-ons as single source of truth

**Schema** (`subscription_plans` already exists)

- Seed/upsert the 4 agreed tiers from the public pricing page: `starter`, `operator`, `network`, `sovereign` — monthly USD, included seats/units, features[], `is_public` flag, `sort_order`.
- New table `subscription_addons` (code, name, unit_label, price, unit_type enum [`per_month`,`per_year`,`pct_gmv`,`per_1k_calls`,`per_claim`], is_active, sort_order). GRANT to authenticated + service_role; RLS: superadmin write, anyone read where `is_active`.

**Admin API**

- Extend `/api/admin/v1/plans` to include the public-facing fields above.
- New `/api/admin/v1/addons` + `/api/admin/v1/addons.$id` (full CRUD).

**Public API**

- New `/api/public/v1/pricing` returning `{ plans: [...], addons: [...], always_included: [...] }` for the website.

**Website pricing page** (`src/routes/pricing.tsx`)

- Replace hardcoded `TIERS` and `ADDONS` constants with a loader that calls `/api/public/v1/pricing` (TanStack Query `ensureQueryData` + `useSuspenseQuery`, per project convention).
- Keep the existing UI 1:1 — only data source changes. FAQ/matrix stays hardcoded.
- Add `errorComponent` + `notFoundComponent` for the route loader.

**Superadmin Plans editor** (existing `PlanEditor`)

- Add fields: `eyebrow`, `tagline`, `units_label`, `seats_label`, `api_label`, `is_public`, `highlight`, `cta_label`, `cta_to`. So edits in Superadmin update the public pricing page immediately.

## 3. Revenue Center — simple financial module

New side-nav entry **Financials** under Revenue, mapped to `tab === "finance"`.

`FinancePane` (read-only v1, no new write surface):

- **KPI strip**: MRR, ARR, active subs, churn (current month), outstanding invoices.
- **Revenue chart**: monthly revenue last 12 months (bar) — derived from `portal_invoices.paid_at` + `amount`.
- **P&L table** (simple, single-currency USD): Revenue (sum of paid invoices) − Refunds (sum of `portal_payments` where `status='refunded'`) − COGS estimate (configurable %, default 18%) = Gross. Then − Opex (manual input from `platform_settings` key `finance.opex_monthly`) = Net.
- **Top tenants by revenue** (last 90 days).
- **Recent invoices** list (10 rows) with status pills.

New endpoint `/api/admin/v1/analytics.finance.ts` returning the aggregates above so the UI does no raw SQL.

No new billing engine — purely a reporting view over data already captured in `portal_invoices` / `portal_payments` / `tenant_subscriptions`.

## 4. Business workspace — same side-nav language

`src/routes/_authenticated/business.tsx` is a single dashboard today. Add a vertical icon-rail + label panel mirroring `SuperadminSideNav` (same collapse behaviour, same teal accent, same grouping pattern).

New component: `src/components/business/BusinessSideNav.tsx` with these groups (only items the subscribed business sees, gated by plan/role):

- **Operations**: Dashboard, Dispatch, Trips, Fleet
- **Care**: Provider, Patient, Telehealth (soon if no add-on), Remote clinics (soon if no add-on)
- **Workforce**: Team & roles, Training (soon unless LMS add-on)
- **Revenue**: My subscription, Invoices, Add-ons marketplace
- **Developer**: API keys, Webhooks, API docs
- **Settings**: Workspace, Branding, Security

Refactor: introduce `src/routes/_authenticated/business/route.tsx` pathless layout that renders the sidebar + `<Outlet />`, move current page to `business/index.tsx`. Stub routes for the new tabs (each marked "Coming soon" if no data wired yet) so the nav works end-to-end without breaking links.

Plan/role gating: items disabled with a small lock icon when the tenant's `subscription_plans.features` doesn't include the corresponding key (e.g. `telehealth`, `lms`). Driven by the same `/api/public/v1/pricing` + the tenant's current subscription.

## Technical notes

- One Supabase migration: `subscription_addons` table + columns added to `subscription_plans` + seed of the 4 tiers and 6 add-ons from the current `/pricing` constants. Followed by GRANTs + RLS policies (superadmin write, public select on `is_public`/`is_active`).
- `/api/public/v1/pricing` uses the **server publishable client** (anon SELECT, no service role) — public read-only data.
- `/api/admin/v1/analytics.finance.ts` uses `requireSupabaseAuth` + superadmin check, returns aggregates only.
- Pricing page route gets a loader + `useSuspenseQuery`; constants removed.
- Business sub-routes use file-based routing (`business/route.tsx` layout + `business/dispatch.tsx` etc.), not directory shims.

```text
SideNav (Superadmin)              SideNav (Business)
├─ Command Center                 ├─ Operations
│  └─ Overview                    │  ├─ Dashboard · Dispatch · Trips · Fleet
├─ Accounts                       ├─ Care
│  └─ Tenants · Requests          │  ├─ Provider · Patient · Telehealth · Clinics
├─ Revenue                        ├─ Workforce
│  ├─ Subscriptions               │  ├─ Team · Training
│  │   ├─ Active · Plans · Add-ons├─ Revenue
│  ├─ Financials  (new)           │  ├─ My subscription · Invoices · Marketplace
│  └─ Refunds (soon)              ├─ Developer · Settings
├─ Access · Developer · …
```



- Multi-currency P&L, accounting export, real invoicing engine — Financials v1 is reporting only.
- New billing/checkout flow.
- Wiring Telehealth/LMS feature toggles to actual capability gates beyond the sidebar lock.