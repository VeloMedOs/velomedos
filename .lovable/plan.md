# Step 5 · Turn 3 closure — route path duplication + CSV streaming debt

## Routing mode clarification (answers your question)

TanStack Start's file-based routing plugin generates `src/routeTree.gen.ts`
from the string passed to `createFileRoute("...")`, **not** from the
filename. Filenames use dots as folder separators (`opd.referral.report.ts`
is just a flat-file form of `opd/referral/report.ts`); the URL path is
whatever the `createFileRoute` string says it is.

`src/routeTree.gen.ts` confirms this — every affected route is registered
under a literal double segment:

```
path: '/api/clinical/v1/opd/opd/referral/report'
path: '/api/clinical/v1/opd/opd/routing/board'
path: '/api/clinical/v1/opd/opd/cashier/allocate'
... (10 total)
```

Meanwhile every client wrapper in `src/lib/clinical-api.ts` calls the
single-`opd/` form (`/api/clinical/v1/opd/referral/report`, etc.). So
**real UI network calls do 404** on all of these routes; fixtures pass only
because they import `handleGET`/`handlePOST` directly and bypass the
router. Demo appears to work because the affected panes (report, routing
board, cashier allocate, disruption bulk-cancel, wallet-gate, pregnancy
link, maternity banner, eligibility-first, registration create-visit,
etc.) haven't been exercised end-to-end through the live network path in
the demo flow yet — the string is not documentation-only, it is
authoritative.

Fix is to correct the `createFileRoute` strings (files stay named as-is;
the dot-form filename is just a convention) and add a smoke test that
resolves URLs through the actual router so this class of bug is caught.

## Scope

Turn 3 closure only. No new features. Two closures:

1. Correct duplicate `opd/opd/` segment in every affected route file.
2. Add router-level URL smoke test.
3. Register debt #48 (CSV streaming for large date ranges).

## Files to edit

Route files (change `createFileRoute` string only; filenames unchanged):


| File                                                                   | Wrong string                                   | Correct string                             |
| ---------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------ |
| `src/routes/api/clinical/v1/opd/opd.referral.report.ts`                | `/api/clinical/v1/opd/opd/referral/report`     | `/api/clinical/v1/opd/referral/report`     |
| `src/routes/api/clinical/v1/opd/opd.referral.report.csv.ts`            | `/api/clinical/v1/opd/opd/referral/report/csv` | `/api/clinical/v1/opd/referral/report.csv` |
| `src/routes/api/clinical/v1/opd/opd.routing.board.ts`                  | `.../opd/opd/routing/board`                    | `.../opd/routing/board`                    |
| `src/routes/api/clinical/v1/opd/opd.disruption.bulk-cancel.ts`         | `.../opd/opd/disruption/bulk-cancel`           | `.../opd/disruption/bulk-cancel`           |
| `src/routes/api/clinical/v1/opd/opd.orders.wallet-gate.ts`             | `.../opd/opd/orders/wallet-gate`               | `.../opd/orders/wallet-gate`               |
| `src/routes/api/clinical/v1/opd/opd.pregnancy-episode.link.ts`         | `.../opd/opd/pregnancy-episode/link`           | `.../opd/pregnancy-episode/link`           |
| `src/routes/api/clinical/v1/opd/opd.registration.eligibility-first.ts` | `.../opd/opd/registration/eligibility-first`   | `.../opd/registration/eligibility-first`   |
| `src/routes/api/clinical/v1/opd/opd.maternity.banner.ts`               | `.../opd/opd/maternity/banner`                 | `.../opd/maternity/banner`                 |
| `src/routes/api/clinical/v1/opd/opd.cashier.allocate.ts`               | `.../opd/opd/cashier/allocate`                 | `.../opd/cashier/allocate`                 |


I will first `rg` the full route directory for `opd/opd/`, `rcm/rcm/`,
`admin/admin/`, etc. and correct every occurrence found (the table above
is the known-8+ list; the sweep will catch any I missed). No client-side
edits — clients are already on the single-segment form.

Note on the CSV route: client calls `/api/clinical/v1/opd/referral/report.csv`
(dot form, matches TSS filename escaping — the `.csv` sits in a single
path segment). I'll declare the route as
`/api/clinical/v1/opd/referral/report.csv` to match the client, keeping
the filename `opd.referral.report.csv.ts` (dots resolve to slashes only
where TSS expects segment boundaries; the trailing `.csv` extension in
the route string maps to the escaped file segment). If TSS refuses the
literal `.csv` in the string (bracket-escape required), I'll rename to
`opd.referral.report[.]csv.ts` per TSS convention and keep the route
string with the dot. This will be verified against `routeTree.gen.ts`
after the plugin regenerates.

## New test — URL resolution smoke

File: `src/routes/api/clinical/v1/opd/__tests__/route-url-resolution.test.ts`

- Import the generated `routeTree` from `src/routeTree.gen.ts`.
- Assert that each of the 10 corrected paths (single-`opd/`) is present
as a registered route id, and that no `/opd/opd/`, `/rcm/rcm/`,
`/admin/admin/` id exists anywhere in the tree.
- Add a `fetch`-style resolution check for 2–3 representative routes
(report JSON, cashier allocate, routing board) by constructing a
matcher from the route tree and confirming the path matches, so future
regressions are caught even without hitting a live server.

This gives us the missing "actual URL resolution, not direct handler
import" coverage the register asked for.

## Debt register update in `.lovable/plan.md`

Add:

> - **#48** — CSV streaming for large date ranges. Currently
> materialize-then-send in `opd.referral.report.csv.ts`; adequate for
> typical monthly reports (~≤2K rows). Migrate to `ReadableStream`
> row-at-a-time chunking when a report crosses ~10K rows in practice or
> when Systems Limited-style consumer requests it. Owner: performance
> turn. Open.

Turn 3 status header updated to note closure hygiene applied
(URL-duplication sweep + smoke test), still 190 baseline + smoke fixtures.

## Verification

- `bun test` — expect 190 + N smoke fixtures green.
- `rg "opd/opd/|rcm/rcm/|admin/admin/" src/routes src/routeTree.gen.ts`
→ 0 hits after regenerate.
- Manual check of `routeTree.gen.ts` after dev restart: every affected
route registered under the single-segment path.

## Clarification accepted — TSS `createFileRoute` string is authoritative and the demo hasn't 404'd only because live UI hasn't hit those panes through the network yet. Fix plan approved with two refinements:

**1. CSV route: the filename change is required, not optional.** `opd.referral.report.csv.ts` — TSS treats every dot as a path separator, so this filename maps to URL `/opd/referral/report/csv` (four segments). Client wrapper calls `/api/clinical/v1/opd/referral/report.csv` (three segments, `report.csv` as one segment). Even after your fix to the createFileRoute string, these still won't match. Rename file to `opd.referral.report[.]csv.ts` (TSS's escape for a literal dot in a filename segment) and set the route string to `/api/clinical/v1/opd/referral/report.csv`. Client wrapper stays as-is. This preserves the natural URL affordance (`.csv` extension implies CSV representation) and matches the download filename convention.

**2. Smoke test is a string-match against** `routeTree.gen.ts`**, not a router invocation.** The generated file registers every route as literal path strings. Fixture reads the file as text, asserts each client-wrapper URL appears verbatim as `path: '<url>'`, and asserts zero occurrences of `/opd/opd/|/rcm/rcm/|/admin/admin/` anywhere. This is a deterministic build-time guarantee that URLs match — catches this whole bug class permanently. Concrete example in message thread.

Everything else in your fix plan is right: rg sweep for double segments, register debt #48, no client-side changes, no CSV streaming refactor. When landed, Step 5 truly closes.  
  
Out of scope

- No client-side changes (already correct).
- No CSV streaming refactor (parked as #48).
- No new features; Step 5 closes after this lands.