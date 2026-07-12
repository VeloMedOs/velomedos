# Status — Step 5 · Turn 3 (shipped @ 2026-07-12)

Turn 3 shipped: Referral report (HCA-1010) — pure aggregator + JSON summary + CSV export + new `opd-referral-report` sub-tab. 6 new fixtures added (total 190 green, baseline 184 + 6). Read-only; zero schema changes.

## Turn 3 build report

- `src/lib/mds/referral-report.ts` — pure aggregator (`buildRows`, `summarise`, `toCsv`, `parseFilters`, `REPORT_SCAN_CAP=5000`). Cluster scope derived from `referral.referral_class` (`external`→external, `inter_company`→sibling, else own). TAT = `created_at → target.updated_at` when target ≠ 'draft'; null otherwise.
- `src/routes/api/clinical/v1/opd/opd.referral.report.ts` — GET JSON. Tenant-scoped; scans up to 5001, flags `truncated`.
- `src/routes/api/clinical/v1/opd/opd.referral.report.csv.ts` — GET CSV. `Content-Disposition: attachment; filename="referral-report-YYYYMMDD-YYYYMMDD.csv"`, exposes `x-report-rows` + `x-report-truncated`. Reuses `fetchReport` from the JSON route so rows can't drift.
- Client: `referralCockpitApi.report(filters)` + `reportCsvUrl(filters)` (anchor-friendly path).
- UI: `ReferralReportPane.tsx` on new `opd-referral-report` tab — filter bar (date range · source · target kind · cluster scope), 4 KPI cards (referrals, rows, acceptance rate, mean TAT), by-source + by-target tables, decline-reasons horizontal-bar list, cluster/series split chips, CSV export anchor, `truncated` badge.
- Tests: `referral-report.test.ts` — aggregation math, cluster partition, decline sort desc, truncation, CSV parity with `totals.rows`, cross-tenant isolation.
- Nav: `opd-referral-report` registered in `nav-config.ts` + mounted in `_authenticated/clinical.tsx`.

Grep gates holding:
- `serviceClient(|\.from(` in `src/components/clinical/daylight/referral/` = 0.
- Raw palette in new files = 0 (only `.clin-pill` + Daylight tokens).
- Single `## Debt Register` heading below.

## Downstream roadmap (parked)

1. Demo security audit — investigation turn, no build, produces threat report.
2. Platform governance — `tenant_type` + Business Management pane + white-label add-on.
3. Batch D reshape against SCM-owns-all.
4. Batch D vs Batch E decision (data-driven from reshape output).

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
- **#45** — Referral write endpoints. **RESOLVED (Turn 2).**
- **#46** — Surgery/OR referral target: fan-out returns `422 target_kind_not_ready`; no `surgery_booking` table yet. Owner: **Batch C_05 OR**. Open.
- **#47** — HCA-1010 audit-log-backed TAT (currently derived from `referral_target.updated_at`). Owner: audit-log spine. Open.

Parked: **#14 / #35** (QMS token spine — QMS batch), **#36** (referral cockpit — resolved Turn 1 read + Turn 2 write + Turn 3 report).

## HCA-1010 report layout (regulator format — deferred to Turn 3b)

Full statutory column set retained for reference (payer/policy joins, PVAT/CVAT split, ICD10, referred provider/doctor). Current CSV covers the referral-audit subset only:
`referral_no, created_at, source_specialty, referral_class, referral_status, target_kind, target_specialty, target_facility_id, cluster_scope, target_status, decision_at, tat_hours, charge_mode, preauth_required, source_key`.

Turn 3b (if requested) will extend the row builder with the payer/policy/patient joins:
Company · TPA · Policy · Class · Network · File No · Patient · Nat.ID · Membership · Parent Letter · Bill · Bill Date · Visit Type · Order Date · ICD10 · Doctor · CTAS · Specialty · Claim Type · Service · Incurred Date · Qty · Gross · Discount · Net · PVAT · CVAT · Deductible · Claim Amount · Referral Ref · Referred Provider · Referred Doctor · Referred Date · Approval # · Cashback %/Amount.
