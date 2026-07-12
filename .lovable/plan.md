# Step 5 · Turn 3 — Referral Report (HCA-1010) + CSV Export

Read-only reporting layer on top of the referral write substrate shipped in Turn 2. New cockpit sub-tab with aggregated metrics + parametric CSV export endpoint. No schema changes expected — reuses `referral`, `referral_target`, `health_cluster`, `corporate_accounts`, `service_master`.

Roadmap parked for later turns (recorded in plan.md, not touched this turn): demo security audit → platform governance (tenant_type + Business Management + white-label) → Batch D SCM reshape → Batch D vs Batch E decision.

## Deliverables

### 1. Server — aggregation + export

- `src/lib/mds/referral-report.ts` — pure aggregator over a `referral` + `referral_target` join. Groups: source_specialty, target_kind, target_encounter_type, cluster (own vs sibling vs external), status. Metrics: volume, accepted/declined/cancelled counts, mean & p90 TAT (created_at → first non-draft status transition), decline reason histogram, series vs single split, nutrition auto-referral share.
- `src/routes/api/clinical/v1/opd/opd.referral.report.ts` — GET, tenant-scoped, filter query: `date_from`, `date_to` (default trailing 30d), `source_specialty?`, `target_kind?`, `cluster_scope?` (own|sibling|external|all). Returns `{ filters, totals, by_source, by_target, by_status, tat: {mean_hours,p90_hours}, decline_reasons[], series_split, cluster_split }`. Cap at 5000 rows scanned; return `truncated: true` when hit.
- `src/routes/api/clinical/v1/opd/opd.referral.report.csv.ts` — GET, same filters. Returns `text/csv` with the row-level dataset (one row per `referral_target`, joined with parent referral): `referral_no, created_at, source_specialty, target_kind, target_encounter_type, target_specialty, target_tenant_id, cluster_scope, status, decision_at, tat_hours, engine_decision_charge_mode, engine_decision_preauth_required, source_key`. `Content-Disposition: attachment; filename="referral-report-YYYYMMDD-YYYYMMDD.csv"`. Streams via chunked string builder, no PII beyond `referral_no` + specialty codes.

### 2. Client wiring

- Extend `referralCockpitApi` in `src/lib/clinical-api.ts` with `report(filters)` (JSON) and `reportCsvUrl(filters)` (returns absolute URL string for `<a href download>`).

### 3. UI — new sub-tab

- `src/components/clinical/daylight/referral/ReferralReportPane.tsx`:
  - Filter bar: date range, source specialty, target kind, cluster scope. Daylight tokens only, `.clin-pill` chips.
  - KPI row (4 cards): total referrals, acceptance rate, mean TAT (h), external blocked share.
  - Two `DCard` tables: **By source specialty** and **By target kind × encounter type**.
  - Third `DCard`: decline reason histogram (horizontal bars via `bg-*` tokens, no chart lib).
  - Footer action: “Export CSV” — triggers `reportCsvUrl` via anchor with `download` attr. Disabled while filters invalid; `truncated` badge when server capped.
- Register `opd-referral-report` tab in `src/components/clinical/daylight/nav-config.ts` and mount in `src/routes/_authenticated/clinical.tsx` next to `opd-referral-series`.

### 4. Tests (target ≥190 green, +6 from 184)

- `src/routes/api/clinical/v1/opd/__tests__/referral-report.test.ts`:
  1. Aggregation math over db-mock fixture (volumes, accepted %, mean TAT).
  2. Cluster scope filter — sibling vs external partition uses `health_cluster` + `referral_target.target_tenant_id`.
  3. Decline reasons histogram sorted desc.
  4. `truncated: true` when scan cap hit.
  5. CSV endpoint headers + row count parity with JSON `totals.rows`.
  6. Tenant isolation — cross-tenant referrals excluded.

### 5. Plan register

- Update `.lovable/plan.md`: mark Turn 3 shipped, add roadmap block for the four downstream turns you sequenced, keep debt register (#18–#23, #41–#44, #46) intact.

## Non-goals (deferred)

- Regulator-format PDF/print of HCA-1010 (out of scope; ask if needed as Turn 3b).
- Chart libraries — inline bar rendering only.
- Schema changes — none.
- Cross-tenant/network aggregation beyond cluster siblings (blocked by debt #22).

## Grep gates (must hold after turn)

- `serviceClient\(|\.from\(` count in `src/components/clinical/daylight/referral/` = 0.
- Raw palette usage (`text-red-`, `bg-red-`, `text-emerald-`, etc.) in new files = 0; only `.clin-pill` variants + Daylight tokens.
- Single `## Debt Register` heading in `.lovable/plan.md`.

## Technical notes

- TAT: derive from `created_at` → earliest of `updated_at` where status transitioned out of `draft` (use `referral_target.updated_at` when status ≠ 'draft'). Document assumption inline; wire an audit-log source in a follow-up if precision needed.
- Cluster scope classification per target: own = `target_tenant_id = auth.tenantId`; sibling = `target_tenant_id ∈ health_cluster.sibling_tenant_ids`; external = `target_kind = 'external_facility'` OR unresolved tenant.
- Both endpoints reuse the pure aggregator from `mds/referral-report.ts` so JSON + CSV can't drift.
- CSV builder is a plain `string[]` join with RFC4180 quoting helper — no dep add.
- Fixtures extend existing `db-mock` seeds; no new seed file.

## Turn-close criteria

- 190+ unit green.
- Manual click-through: new tab renders, filters apply, CSV downloads with correct rows, empty state clean.
- Grep gates hold.
- plan.md updated with Turn 3 shipped + downstream roadmap block.  
  
HCA - 1010: Referral Report Layout:  


  |                  |              |                 |               |           |             |             |                  |                 |                   |                   |             |               |                |                |                |                |                 |                |               |                |                  |                         |                   |         |                  |              |         |          |          |                       |                  |                         |                      |                    |                  |                 |                 |                      |
  | ---------------- | ------------ | --------------- | ------------- | --------- | ----------- | ----------- | ---------------- | --------------- | ----------------- | ----------------- | ----------- | ------------- | -------------- | -------------- | -------------- | -------------- | --------------- | -------------- | ------------- | -------------- | ---------------- | ----------------------- | ----------------- | ------- | ---------------- | ------------ | ------- | -------- | -------- | --------------------- | ---------------- | ----------------------- | -------------------- | ------------------ | ---------------- | --------------- | --------------- | -------------------- |
  | **Company name** | **TPA name** | **Policy Name** | **Policy NO** | **Class** | **Network** | **File No** | **PATIENT NAME** | **National ID** | **Membership No** | **Parent Letter** | **Bill No** | **Bill Date** | **Visit Type** | **Order date** | **ICD10 CODE** | **ICD10 DESC** | **Doctor Name** | **CTAS Score** | **Specialty** | **Claim type** | **Service Code** | **Service Description** | **Incurred Date** | **Qty** | **Gross Amount** | **Discount** | **Net** | **PVAT** | **CVAT** | **Deductible Amount** | **Claim Amount** | **Referal Refrence No** | **Refered provider** | **Refered Doctor** | **Refered Date** | **Approval No** | **Cash back %** | **Cash back Amount** |


  |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |        |
  | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ |
  | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; |
  | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; |
  | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; |
  | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; |
  | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; |
  | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; |
  | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; |
  | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; |
  | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; |
  | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; |
  | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; |
  | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; |
  | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; | &nbsp; |
