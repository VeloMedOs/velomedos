# VeloMed OS — Website Redesign (FINAL, fully-wired Lovable prompt)

Frontend-led marketing-site rewrite. Reuses existing `CommandHero`, `business_intake`, `PipelineBoard`, `LegalCmsModule`, `site-config`, `ResponsiveImage`. No other portal restyle. **Every UI element below is mapped to a real endpoint in §A — no element ships without its data wired.**

## 0. Hard rules

- **Reuse the existing operations hero (**`CommandHero`**) unchanged.** Wrap it in a mode toggle; never reimplement the map/GPS/gauges.
- Brand tokens fixed (§1). One CTA voice ("Book a demo"). Calm, operational, never patient-facing.
- Honesty: "integration-ready / sandboxed until credentials are live" — never claim certs not held.
- No raw `<form>` in React routes (controlled inputs + onClick). No new npm deps. `tsgo` green.
- Touch only the marketing site + the Superadmin Pages-&-CMS surface. Clinical/dispatch/business/ patient portals untouched.

## 1. Brand tokens (reuse repo's `styles.css`; do not add tokens)

`--ink:#080B11 --surface:#0E131C --panel:#0B1019 --tile:#0E141E --line:#1C2532 --line2:#243042` `--teal:#28D6B6 --teal-ink:#06281F --sky:#4FB6F7 --coral:#FF6E5B --amber:#F4B24C --violet:#7C3AED` `--hi:#EAF0F7 --txt:#A9B5C6 --mut:#8593A6 --dim:#5E6C82`. Fonts: Fraunces (display/italic) · Hanken Grotesk (body) · JetBrains Mono (data/labels/codes). Severity = state: teal clean/eligible · sky in-progress/region · coral critical/denial · amber awaiting · violet VBHC.

## A. API / ROUTE WIRING MAP (no truncated flows) — verified against the repo


| UI element                                                                                           | Endpoint                                                                                | Method  | Status     | Notes                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Hero stat cards (Movement/Patient/Next)                                                              | `/api/public/v1/stats`                                                                  | GET     | **exists** | resolve in route **loader** (SSR)                                                                                                      |
| Partner marquee + count                                                                              | `/api/public/v1/partners`                                                               | GET     | **new**    | reads `public_partners` **view** (§E), `{count, items[]}`; loader-resolved                                                             |
| Care & Revenue lens values                                                                           | —                                                                                       | —       | static     | placeholders mirroring mockup; no endpoint (or later anonymized stats)                                                                 |
| Partner intake form submit                                                                           | `/api/public/v1/business_intake`                                                        | POST    | **exists** | already inserts `business_requests` (`source:'website', stage:'request', status:'new'`) → triggers `business_request_events` 'created' |
| Marketing copy (hero/pillars/CTA/…)                                                                  | `/api/public/v1/site-content`                                                           | GET     | **new**    | published-only (§D); loader-resolved; `SITE` const = fallback                                                                          |
| Staff login link                                                                                     | `/his` (existing launcher)                                                              | nav     | exists     | discreet "Staff login →"                                                                                                               |
| CMS — edit pages                                                                                     | `/api/admin/v1/site-content`                                                            | GET/PUT | **new**    | superadmin guard; writes draft/published                                                                                               |
| CMS — featured partners                                                                              | `/api/admin/v1/business-requests/$id/featured`                                          | PATCH   | **new**    | writes `display_*`, logs `business_request_events` 'featured_changed' + 'display_consent_changed'                                      |
| CMS — pipeline/subscribers                                                                           | existing `PipelineBoard` + `/api/admin/v1/subscribers`, `business-requests.$id.advance` | —       | exists     | surface as a tab                                                                                                                       |
| CMS — legal                                                                                          | existing `LegalCmsModule`                                                               | —       | exists     | tab                                                                                                                                    |
| **Every public read is resolved in a TanStack Start route loader (server) so it is in the SSR HTML — | &nbsp;                                                                                  | &nbsp;  | &nbsp;     | &nbsp;                                                                                                                                 |
| required for SEO + LCP<2.5s + CLS<0.1. No client-only data fetch for above-the-fold content.**       | &nbsp;                                                                                  | &nbsp;  | &nbsp;     | &nbsp;                                                                                                                                 |


## 2. Hero — `HeroCommandPanel.tsx` wrapping `CommandHero`

`OPERATIONS | CARE & REVENUE` toggle + LIVE badge. OPERATIONS → existing `CommandHero` unchanged. CARE & REVENUE → `CareRevenuePanel.tsx`: sub-tabs `eligibility | authorization | claim`; revenue meters (First-pass %, Denial %, Days-to-claim); Coding & Compliance row (PDx/ACHI/DRG/MDS + NPHIES ACCEPTED · ZATCA CLEARED); money breakdown bar (gross → contractual → DRG bundle → payer/patient/VAT); three lens panels (Clinical/Revenue/Compliance). Left column: Fraunces headline *"From your whole network down to one crew."*, eyebrow, subcopy, Book-a-demo/See-the-platform, three stat cards ← `/api/public/v1/stats`.

## 3. Section order (build all; components listed)

Nav (AR/EN) → Hero → **Partner marquee** (`PartnerMarquee.tsx` ← `/partners`) → **Category line** ("Others give you an HIS, *or* an RCM, *or* a dispatch system. VeloMed OS is the OS for all three.") → **Problem/by-the-numbers** (5–12% leakage · ~SAR 4k/bed · 60–270-day pay cycles vs 45-day rule) → **Platform** (`#platform`, 3 pillars Operations/Clinical/Revenue + "born unified") → **Outcomes/ROI** (illustrative, labeled) → **Who it's for** (`#roles`, chips from `clinical-role-matrix.ts`) → **One journey** (arrival→settlement) → **Integrations** (NPHIES·ZATCA·D365·LIS/PACS·Kayan HR·payers/TPAs· devices) → **Security & governance** (role matrix + privilege audit + KSA residency) → **Compliance & certifications** (`#compliance`, honest status row) → **Proof** (2–3 number-driven testimonials + partner logos) → **How it works** (sandbox-first, weeks-not-years) → **Partner capture** (`#partner`, §C) → **CTA** (repeat mid-page too) → Footer. Reference: `velomed_site_hero_mockup.html`.

## B. Why this beats the field (bake into copy, don't restyle)

KSA is crowded (OASIS Systems — unified HIS+ERP+RCM, even uses "one source of truth"; Health Cluster, Cirrus, Waseel, Cloudpital, Xocialive; Klaim owns "cash in 24h"). "NPHIES-compliant" is table stakes. Win on the wedge — **operations + clinical + revenue in one OS** ("from the ambulance to the cleared claim"), **born unified** vs bolted-together incumbents, a **live real-product hero**, and **governance-as-feature**. Rationale: `VeloMed_Competitive_Research_Website_Strategy.md`.

## C. Partner / business-subscriber capture (`PartnerIntakeSection.tsx`)

Controlled inputs (no raw `<form>`), ≤6 effective fields: org name, type (hospital/clinic group/EMS/ payer-TPA), contact name, work email, phone, message, consent checkbox + honeypot. Submit → `POST /api/public/v1/business_intake` (existing; persists to `business_requests`, source=website). Success inline; failure inline. Lands in the existing `PipelineBoard`.

## D. Superadmin → **Pages & CMS** (extend, don't duplicate)

Promote the "Website CMS" group in `SideNav.tsx` (`superadmin.tsx` routes). Tabs:

- **Pages & sections** (`PagesContentPane.tsx`) — edit hero/pillars/roles/compliance/partner/CTA copy. Bundled defaults in `site-config.ts` (re-pointed to **KSA HIS+RCM** positioning — the current `SITE` is UAE/mobility and is off-brand for this redesign). DB overlay `site_content (key text pk, value jsonb, locale text, status text default 'draft', updated_at)`. **Public GET returns published only.** RLS superadmin-write; `TO anon` SELECT only on published rows. Resolver `getSiteContent(key, fallback)` in loaders; `{en, ar}` shape falls back to `en` when `ar` absent.
- **Featured partners** (`FeaturedPartnersPane.tsx`) — list `business_requests`, toggle `display_publicly` + `display_consent`, edit `display_name/city/type/logo_url/featured_order`. Writes via the admin PATCH (§A) and logs events.
- **Legal** — existing `LegalCmsModule`. **Subscribers/Pipeline** — existing `PipelineBoard`.

## E. Migration + the public partners view (PII-safe)

- Extend `business_requests`: `display_publicly bool default false`, `display_consent bool default false`, `display_consent_at timestamptz`, `display_consent_source text`, `display_name text`, `display_city text`, `display_type text`, `logo_url text`, `featured_order int`.
- **Do NOT grant** `TO anon` **on** `business_requests` (RLS filters rows, not columns → would expose contact email/phone/message of featured rows). Instead: 
  ```sql
  CREATE VIEW public.public_partners AS  SELECT display_name AS name, display_city AS city, display_type AS type,         logo_url, featured_order  FROM public.business_requests  WHERE display_publicly = true AND display_consent = true;GRANT SELECT ON public.public_partners TO anon;   -- view only; base table stays private

  ```
  Public display is gated by the **explicit flags only**, decoupled from pipeline `stage`.
- `/api/public/v1/partners.ts` selects from `public_partners` ordered by `featured_order`, returns `{ count, items:[{name, city, type, logo_url}] }`.
- `site_content` table + GRANTs + RLS as §D. Admin/public site-content routes + featured PATCH route.

## F. Bilingual + a11y

AR/EN toggle in `SiteHeader` → `localStorage` + `dir="rtl"` on `<html>`; strings from site-config/overlay `{en,ar}`; scaffold switch + RTL now, full AR copy follows. One H1 (hero), semantic H2/H3 (no skipped levels), labelled inputs, focus-visible, reduced-motion on marquee/toggles, AVIF/WebP via `ResponsiveImage`. Mid-page CTA repeats; partner form ≤6 fields.

## G. Docs / DoD

`his-technical-manual.md` (site IA, Care&Revenue lens, intake→pipeline→portfolio→marquee, CMS content model incl. `public_partners` view + publish state); `his-user-manual.md` ("Edit the website", "Triage subscriber → Featured partners → consent"); `changelog.md` entry. OpenAPI: add `partners`, `site-content`, `featured`; verify `/superadmin/api-docs`. `tsgo` green; no new deps; no `<form>`; other portals untouched.

## H. Acceptance (every flow end-to-end)

1. Hero shows existing OPERATIONS unchanged + full CARE & REVENUE under the toggle; stat cards load from `/stats` in SSR.
2. All tabs wired: OPERATIONS/CARE, network/region/team, eligibility/authorization/claim.
3. Partner form → `business_intake` → appears in PipelineBoard → **Advance** progresses stage (events logged).
4. Marquee shows only consented/approved partners from `public_partners`; flipping "Display publicly" in Featured partners adds/removes a logo; a raw intake **never** appears publicly; base table PII is unreachable by `anon`.
5. Superadmin edits hero/pillar/CTA copy → saved as draft → **publish** → reflected on the SSR'd site; drafts never served publicly.
6. AR/EN toggles RTL; reduced-motion respected; one H1; Lighthouse a11y/perf sane (LCP<2.5s, CLS<0.1).  
