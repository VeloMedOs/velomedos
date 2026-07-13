# ZZ1 — Restore Debt Register in `.lovable/plan.md`

Single closure to fully close Round 1. No code changes.

## Action

Append a proper `## Debt Register` section to the **end** of `.lovable/plan.md`, preserving all existing turn-plan prose above it verbatim. Do not rewrite the file.

## Content to append

```
## Debt Register

**#18** — Rule C series dormant until `service_master.sub_category='series_therapy'` seeded (Batch C service catalog).
**#19** — BRS to confirm `approx_perform_minutes` vs `tat_minutes` for OPD visit duration.
**#20** — `visit_type` spec-vs-code naming divergence (`new` ↔ `new_consult`).
**#21** — `maternity_protocol.next_anc_due_at` missing; literal `start_date + 280d` cadence carries the current display.
**#22** — `referral_network` table needed before Step 5 external referral write path.
**#23** — Portal self-booking compat layer pending review.
**#41** — ZATCA credit-note linkage; VAT engine turn.
**#42** — RESOLVED (WW2 fold — legacy `is_demo` flag removed from demo-mode.ts).
**#43** — D7 form bindings; carried to next batch.
**#44** — Hijri calendar (HCA-0051); E2b placeholder in place.
**#46** — Surgery/OR referral target (surgery_booking table). Owner: Batch C_05 OR.
**#47** — HCA-1010 audit-log-backed TAT; Owner: audit-log spine.
**#48** — CSV streaming for large date ranges; Owner: performance turn.
**#49** — RESOLVED (Demo Security Audit now scheduled against Batch 2 hardened surface).
**#50** — RESOLVED (Six Phases provisioning coordination handoff — request-side shipped in Batch 1, review UI shipped in Batch 2).

Parked: #14/#35 (QMS token spine — Owner: QMS batch). #36 fully resolved by Step 5.
```

## Workflow guardrail (permanent)

Add a note at the top of `.lovable/plan.md` (or update the existing convention line) codifying Convention #25:

- Never overwrite `.lovable/plan.md` wholesale.
- Turn plans append above the `## Debt Register` section; the register stays pinned at end-of-file.
- Debt edits are **row-delta only** — locate the specific `**#N**` line and edit in place; never rewrite the section.
- Before writing to plan.md, re-read the current file and preserve the trailing `## Debt Register` verbatim except for the specific `**#N**` rows being changed this turn.

## Verification

- `rg -n '^## Debt Register' .lovable/plan.md` → exactly 1 match, near EOF.
- `rg -c '^\*\*#[0-9]+\*\*' .lovable/plan.md` → 15 rows.
- Existing Batch 2 turn-plan prose above the register left untouched.

No tests, no code, no migrations. Once landed, Round 1 fully closes and Demo Security Audit is unblocked.

---

## Convention #25 (guardrail, permanent)

- Never overwrite `.lovable/plan.md` wholesale.
- Turn plans append above the `## Debt Register` section; the register stays pinned at end-of-file.
- Debt edits are **row-delta only** — locate the specific `**#N**` line and edit in place; never rewrite the section.
- Before writing to plan.md, re-read the current file and preserve the trailing `## Debt Register` verbatim except for the specific `**#N**` rows being changed this turn.

## Debt Register

**#18** — Rule C series dormant until `service_master.sub_category='series_therapy'` seeded (Batch C service catalog).
**#19** — BRS to confirm `approx_perform_minutes` vs `tat_minutes` for OPD visit duration.
**#20** — `visit_type` spec-vs-code naming divergence (`new` ↔ `new_consult`).
**#21** — `maternity_protocol.next_anc_due_at` missing; literal `start_date + 280d` cadence carries the current display.
**#22** — `referral_network` table needed before Step 5 external referral write path.
**#23** — Portal self-booking compat layer pending review.
**#41** — ZATCA credit-note linkage; VAT engine turn.
**#42** — RESOLVED (WW2 fold — legacy `is_demo` flag removed from demo-mode.ts).
**#43** — D7 form bindings; carried to next batch.
**#44** — Hijri calendar (HCA-0051); E2b placeholder in place.
**#46** — Surgery/OR referral target (surgery_booking table). Owner: Batch C_05 OR.
**#47** — HCA-1010 audit-log-backed TAT; Owner: audit-log spine.
**#48** — CSV streaming for large date ranges; Owner: performance turn.
**#49** — RESOLVED (Demo Security Audit now scheduled against Batch 2 hardened surface).
**#50** — RESOLVED (Six Phases provisioning coordination handoff — request-side shipped in Batch 1, review UI shipped in Batch 2).

Parked: #14/#35 (QMS token spine — Owner: QMS batch). #36 fully resolved by Step 5.
