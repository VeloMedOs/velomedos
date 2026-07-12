# Status — Step 5 · Turn 3 closure (shipped @ 2026-07-12)

Turn 3 closure landed: `opd/opd/` path-duplication swept across every OPD route file (34 files), CSV route renamed with TSS `[.]` filename escape, URL-resolution smoke fixture added. **221/221 unit green** (baseline 190 + 31 smoke fixtures). Step 5 closes.

## Closure build report

### 1. Path duplication swept (correction to Turn 1 TSS routing note)

Clarified: TanStack Start derives the route ID from **the filename**, and
the `createFileRoute("...")` string MUST match. Correcting only the string
would trigger the "route-tree path mismatch" build error; the file must be
renamed. Fix applied uniformly to all 34 OPD route files.

- Directory `src/routes/api/clinical/v1/opd/` — every `opd.*.ts` renamed
  to drop the leading `opd.` segment (parent dir already contributes it):
  `opd.referral.report.ts` → `referral.report.ts`, and so on for all 34
  files.
- CSV route: `opd.referral.report.csv.ts` → `referral.report[.]csv.ts`
  (TSS `[.]` filename escape for a literal dot in a single URL segment).
  Route string set to `/api/clinical/v1/opd/referral/report.csv`, which
  is what the client wrapper has always called.
- Every `createFileRoute("...")` string updated in-place to the
  single-`opd/` form.
- Test imports updated (`../opd.X` → `../X`, CSV import uses literal
  bracket form `../referral.report[.]csv`).
- No client-side changes required — `src/lib/clinical-api.ts` already
  called the single-`opd/` form (that was the mismatch that caused
  silent 404s in live network calls).

Post-fix invariants:
- `rg "opd/opd/|rcm/rcm/|admin/admin/" src/routeTree.gen.ts` = 0.
- Route tree now registers every URL at the client-called path (e.g.
  `path: '/api/clinical/v1/opd/referral/report'`,
  `path: '/api/clinical/v1/opd/referral/report.csv'`).

### 2. URL-resolution smoke fixture

`src/routes/api/clinical/v1/opd/__tests__/route-url-resolution.test.ts` —
reads `src/routeTree.gen.ts` as text and asserts:

- Zero occurrences of `/opd/opd/`, `/rcm/rcm/`, `/admin/admin/` anywhere
  in the generated tree.
- Every one of 30 client-called URLs appears as either `id: '<url>'` or
  `path: '<url>'` in the tree. Layout-child routes are registered only
  by id (path is inherited from parent), standalone routes by both;
  fixture accepts either form.

This is a deterministic build-time guarantee that URLs match the
generated tree — catches the whole duplicate-segment class permanently
without requiring a live server.

### 3. Debt register updates

- **#48 opened** — CSV streaming for large date ranges.
- Turn 3 body (report pane + CSV export) previously shipped and remains
  intact; the closure edits are surgical route-string/filename changes
  only.

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
- **#48** — CSV streaming for large date ranges. `referral.report[.]csv.ts` materialises the whole CSV in memory before responding — adequate for typical monthly reports (~≤2K rows). Migrate to `ReadableStream` row-at-a-time chunking when a report crosses ~10K rows in practice, or when a Systems Limited-style consumer requests it. Owner: performance turn. Open.

Parked: **#14 / #35** (QMS token spine — QMS batch), **#36** (referral cockpit — resolved across Turns 1/2/3).

## Step 5 — closed

Three turns delivered:
1. Cluster data + cockpit reads + rules admin facade.
2. Referral write endpoints (fan-out, inter-company, series, nutrition
   accept/decline) + UI dialogs.
3. Referral report (HCA-1010) pane + CSV export + closure hygiene
   (path-duplication sweep + URL-resolution smoke).

## Downstream roadmap (parked)

1. Demo security audit — investigation turn, no build, produces threat report.
2. Platform governance — `tenant_type` + Business Management pane + white-label add-on.
3. Batch D reshape against SCM-owns-all.
4. Batch D vs Batch E decision (data-driven from reshape output).
