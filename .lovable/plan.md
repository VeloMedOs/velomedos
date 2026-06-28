## Goal

Revamp `/pricing` into a real, research-grounded pricing page modeled after RufayQ's structure — keeping VeloMed's dark Clinical Precision aesthetic and the B2B/fleet reality (no consumer pricing).

## Pricing research (B2B EMS / dispatch SaaS benchmark)

Typical market shapes I'll anchor the tiers against:

- **Per-vehicle / per-unit SaaS** (ESO, ImageTrend, Tarmac, Beyond Lucid): ~USD 80–250 / ambulance / month for dispatch + ePCR, more for analytics & compliance modules.
- **Per-seat dispatch consoles** (Traumasoft, RescueNet): ~USD 60–120 / dispatcher / month.
- **Telehealth / remote-clinic platforms**: USD 1–3 / consult or USD 5–15 / patient / month bundles.
- **Training & certification LMS** (Relias, Vector Solutions EMS): USD 25–60 / learner / year.
- **Public API tiers**: free sandbox → metered (per 1k calls) → committed throughput + SLA.
- **Enterprise / sovereign**: annual contract, dedicated cluster, custom SLA, no public price.

I'll publish list anchors in **USD** with a note that SAR/AED billing is available, since the project is GCC-leaning but sells regionally.

## New /pricing structure (mirrors RufayQ's anatomy)

1. **Hero** — headline, sub, billing toggle (Monthly / Annual — save 2 months), currency hint (USD shown, SAR/AED on invoice).
2. **Four plan tiers** in one grid (replaces today's 3 "Custom" cards):
  - **Starter — Single Branch** · from **$1,490/mo** · up to 10 units, 3 dispatcher seats, core dispatch + provider + patient app, public API sandbox.
  - **Operator — Multi-Branch** · from **$4,900/mo** · up to 50 units, 10 seats, fleet compliance, telehealth add-on ready, API 100k calls/mo.
  - **Network — Regional** *(Most chosen)* · from **$12,500/mo** · up to 200 units, unlimited seats, multi-tenant, training LMS, API 1M calls/mo, priority support.
  - **Sovereign — Platform** · Custom · unlimited units, dedicated cluster, custom SLA, on-prem/in-country residency, 24/7 named support.
   Each card: eyebrow, name, price, "/month billed annually" line, target descriptor, feature checklist, CTA (`/demo` for paid, `/contact` for Sovereign), one highlighted card.
3. **Module add-ons grid** (matches RufayQ add-ons section):
  - Remote Clinic Pods · per pod / month
  - Ambulance Rental Marketplace · % of GMV
  - Training & Certification LMS · per learner / year
  - Public API — metered overage · per 1k calls
  - Compliance & Credential Vault · per branch / month
  - Insurance Claims Concierge · per claim
4. **What's always included** strip — dispatch console, provider + patient apps, public REST API + Swagger, audit log, RLS multi-tenant, SSO/SAML on Network+.
5. **Comparison matrix** — feature × tier table (units cap, seats, API quota, SLA %, support tier, branch hierarchy levels, telehealth, LMS, on-prem).
6. **API pricing micro-section** — Sandbox (free), Metered ($0.40/1k after 100k), Committed (talk to us). Links to `/api-reference`.
7. **FAQ** (6 items, JSON-LD FAQPage): plan changes, currency/VAT, data residency, SLAs, contract length, free pilot.
8. **Closing CTA band** — "Book a scoped demo" → `/demo`, "Talk to sales" → `/contact`.

## Technical details

- Single file change: `src/routes/pricing.tsx` (no schema, no API).
- Add `faqLd` JSON-LD alongside existing breadcrumb.
- Keep `SiteHeader` / `EmergencyBanner` / `SiteFooter`.
- Use existing tokens: `bg-panel`, `border-hairline`, `text-action`, `text-stable`, `mono`. No new colors.
- Billing toggle = local `useState<"monthly"|"annual">`; annual displays monthly equivalent with "−2 months" badge.
- Currency note line only (no live FX); RufayQ-style currency switching is out of scope (no catalog tables on this project).
- Comparison matrix as a semantic `<table>` for SEO; sticky first column on desktop only.
- Update meta `description` to reflect tiered pricing.
- No changes to landing `index.tsx`, schema, or APIs.

- Wiring `pricing_plans` from the `/superadmin` Plans CRUD into this page (those are tenant subscription plans, a different surface). Can be a follow-up.
- Multi-currency switcher, i18n, Arabic copy.
- Do the necessary E2E testing and validations
- Add the ability to manage subscriptions & Add-Ons from admin panel for specific business to upgrade or downgrade the requests and shall be pending superadmin approval and to display this in the Subscription managment module / section in the superadmin panel 