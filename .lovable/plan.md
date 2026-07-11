# Status — Step 5 · Turn 1 (post-closure hygiene @ 2026-07-11)

Turn 1 shipped: 5 pure-handler routes (referral cockpit + cross-encounter + inter-company + external + rules-admin), 5 Daylight panes, `health_cluster` + `corporate_accounts.cluster_id` migration. 165/165 unit tests green.

Post-closure fixes landed this turn:
- Rules-admin route relocated to RCM group: `src/routes/api/clinical/v1/rcm/rcm.rules.admin.ts` (tab id `rcm-rules-admin` now aligns with folder).
- Raw palette removed from `ExternalReferralsPane` (banner → `.clin-pill.warn`) and `ReferralCockpitPane` (`Chip` → `.clin-pill` tone classes). Residual `text-slate-500` on table sub-labels is inherited shadcn/`DCard` default — kept.
- Verified `evaluateTriggers` already routes `scope='referral'` correctly (rules.ts line 155: `if (r.scope !== scope) continue`); line-108 filter is inside `evaluate()` (share/eligibility path) and does not gate triggers. `rules-referral.test.ts` imports the production function, no mock.
- Verified `pricing_rule.scope` has no CHECK constraint (empty `pg_constraint` result); rules-admin POSTs with `scope='referral'` succeed without a migration.

## Turn 2 preview

Referral write endpoints (debt #45): cross-encounter fan-out, inter-company target creation, series booking. Consumes existing referral/scheduling spine — no new tables.

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
- **#45** — Referral write endpoints (cross-encounter fan-out, inter-company target creation, series booking). Owner: Step 5 Turn 2. Open.

Parked: **#14 / #35** (QMS token spine — QMS batch), **#36** (referral cockpit — resolved read-side by Turn 1; write surface tracked as #45).
