# Status — Step 5 · Turn 2 UI round (shipped @ 2026-07-12)

UI round: FanOutDialog + IPDStubBanner, InterCompanyDialog, SeriesBookingPane on new `opd-referral-series` tab, ReferralCockpitPane row actions (Fan out / Accept / Decline). 8 UI-contract fixtures added (total 184 green).

Turn 1 closed at 165/165. Turn 2 in progress: 5 referral write endpoints (`create`, `fan-out`, `inter-company.create`, `series.create`, `nutrition.accept`), 2 new migrations (`referral.origin_source`, `referral_target.source_key` UNIQUE idempotency substrate), FanOut / InterCompany dialogs + new `SeriesBookingPane`.

Repo-truth corrections applied vs draft prompt:
- `referral.status` **and** `referral_target.status` share enum `public.referral_status = ('draft','submitted','accepted','declined','completed','cancelled')`. Writes use enum values only — no `'requested'|'booking'|'eligibility'|'preauth'` literals (same class as Turn 1 `pricing_rule.scope` near-miss).
- `encounter.class` is `text` (not enum) — ER fan-out writes `class='EMER'` freely.
- `admission_request` NOT-NULL / no-default = `tenant_id`, `encounter_id`. Rest defaulted.

## Debt Register

- **#18** — Rule C series therapy seeding. Open.
- **#19** — BRS to confirm `approx_perform_minutes` vs `tat_minutes`. Open.
- **#20** — `visit_type` naming divergence. Open.
- **#21** — `maternity_protocol.next_anc_due_at` missing (literal cadence in place). Open.
- **#22** — `referral_network` table needed before external write path (skeleton shipped Turn 1). Open.
- **#23** — Portal self-booking compat layer. Open.
- **#41** — ZATCA credit-note linkage. Owner: VAT engine turn. Open.
- **#42** — SMS gateway integration. Open.
- **#43** — D7 form bindings. Open.
- **#44** — Hijri calendar (HCA-0051, E2b placeholder in place). Open.
- **#45** — Referral write endpoints (cross-encounter fan-out, inter-company target creation, series booking). Owner: Step 5 Turn 2. **RESOLVED (Turn 2).**
- **#46** — Surgery/OR referral target: `referral_target.target_kind='encounter', target_encounter_type='OR'` returns `422 target_kind_not_ready` from fan-out; no `surgery_booking` table yet. Owner: **Batch C_05 OR**. Open.

Parked: **#14 / #35** (QMS token spine — QMS batch), **#36** (referral cockpit — resolved read side Turn 1 + write side Turn 2).
