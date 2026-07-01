# RCM R2 verdict + R3 (Claims scrub/assemble/submit) — validated, paste-ready

Validated against `velomedos@4174ff3`.

---

## PART A — R2 engine: CORRECTLY WIRED, no amendment

The shipped `src/lib/rcm/auth-engine.ts` matches the R2 schema exactly:

- `authorization_request` insert — every field is a real column (`reasons_triggered`, `requested_by`, `eligibility_ref`, `coverage_id`, `status`, …). ✓
- `authorization_item` insert — `source`, `service_id`, `drug_id`, `charge_item_id`, `quantity`, `quantity_code`, `reason` all exist; `decision` is a real column (`CHECK IN ('pending','approved','partial','rejected')`), so `resolveConversion` is valid. ✓
- `isInsured` reads `encounter.coverage_id` → **exists** (FK to `coverage`), so triggers actually fire. ✓
- `service_master`/`drug_master` reads (`preauth_required`, `sub_category`, `atc_code`) — real. ✓

**One caveat (not a fix):** `conditionMatches` returns `false` for any unknown `condition` key, so a `need_approval_rule` using a key the engine doesn't handle silently never matches. As rule taxonomy grows, add handled keys in lockstep — otherwise new rule types are inert. Document the supported key set.

---

## PART B — R3 Claims (scrub / assemble / submit) — corrected

R3 legitimately ships a migration + new routes. **Confirmed present:** `claim.status` is a **text CHECK** (`CHECK (status IN ('draft','ready','submitted','accepted','rejected'))`) — not an enum; `claims.$id.submit.ts`, `claim_submission_attempt`, and `replaces_claim_id` all exist; `validation.ts` exists (rcm + mds). Five corrections:

### [FIX 1 — invented roles] use the real role names

The plan gates RLS/policies on `billing_officer` / `claim_specialist` — **neither exists** in `clinical_role`. Use `biller` and `claims_officer` (+ `rcm`, `finance`, `tenant_admin`, `superadmin`) — the real roles the `Claims & Remittance` matrix module already maps. Module gate stays `requireClinicalModule('Claims & Remittance', <cap>)`.

### [FIX 2 — blockers are mostly NEW, not "reused"] define them in `src/lib/rcm/validation.ts`

Only `AUTH_MISSING` exists today. `ELIG_INVALID`, `ICD_MISSING`, `PRICE_STALE`, `DRG_UNGROUPED`, `CHARGE_ZERO`, `COVERAGE_EXPIRED`, `SIG_MISSING` are **new** — the scrubber must **define** them in `src/lib/rcm/validation.ts` following the existing blocker shape (`{ code, severity, message, fixHint, deepLink }`), reusing only `AUTH_MISSING`. Don't claim reuse for codes that aren't there. Keep them deterministic + idempotent (safe for bulk re-run).

### [FIX 3 — claim status migration is SAFE, just name the constraint]

`claim.status` is a CHECK, so the plan's "drop and re-add with 14 states" is correct (no enum ADD-VALUE hazard). All five current values (`draft, ready, submitted, accepted, rejected`) are inside the new 14-state set, so existing rows won't violate the new CHECK. **Confirm the constraint name** before dropping (Postgres inline default = `claim_status_check`) and keep it a **CHECK** (do not convert to an enum). Map: existing `submitted/accepted/rejected` unchanged; new sub-states additive.

### [FIX 4 — `authorization_request.decision` does not exist] fix the refresh trigger

The plan's trigger "on `authorization_request.decision` update → touch draft claims" references a column that isn't there — the request table has `status`, `decision_at`, `decision_reason`, `reasons_triggered`; the `decision` column is on `authorization_item`. So fire the trigger on `authorization_request.status` change (e.g. → `approved`/`partially_approved`) OR on `authorization_item.decision` change, whichever advances the claim. Same correction anywhere R3 reads an "auth decision" at the request level — read `status` there, `decision` on items.

### [FIX 5 — RcmStubs.tsx doesn't exist] wire into the real tab stub

`ClaimsWorklistPane` "replaces stub in `RcmStubs`" — there is no `RcmStubs.tsx`. Wire it into wherever the `rcm-claims` tab currently renders its placeholder (inline stub in `clinical.tsx`), same as the R2 `rcm-authorization` swap.

### Confirmed-good — keep as written

- 14-state `claim-sm.ts` + `claim_lifecycle_event` audit + advisory lock (10-min TTL, R2 pattern).
- `assemble` freezes charge snapshot, pulls DRG/coding, **links R2 auth via** `authorization_item.decision` (real column) and uses the exported `resolveConversion` to snapshot covered qty/amount — this is the clean R2→R3 seam.
- Routes `claims/worklist.ts`, `$id.{assemble,scrub,void,resubmit,lifecycle}.ts`, `bulk.ts` returning `{ results: [{ id, ok, error? }] }` (matches R2 bulk contract); `submit.ts` hardened (idempotency key, SM guard, sandbox stub, persist to `claim_submission_attempt`); `resubmit` links `replaces_claim_id` (real column).
- Masters `scrub_rule` / `submission_channel` via **direct CRUD** (`masters/scrub-rules`, `masters/submission-channels`) — not `contract_change_request` (R2 FIX 3 convention).
- **HIS linkage:** `EncounterPane` claim-status chip from `claims.$id.completeness`; `DischargePanel` auto-assemble when journey → discharged + coded; `AuthorizationPane` decision writes invalidate the claim worklist query so `AUTH_MISSING` clears without manual refresh; Coding pane "Send to claim" → `assemble`.
- **R1 linkage:** worklist joins `visit_eligibility` for the encounter; `ELIG_INVALID` deep-links to the R1 Eligibility Worklist row (real `EligibilityStatus` tokens + shared `toneOf`).
- Worklist mirrors R1/R2 (bucket pill counts, shared `toneOf`/`formatHalalas`/`CapGate`, sticky bulk bar with per-row toast, dry-run toggle for Scrub, lock badge). Buckets: Draft · Scrub Failed · Ready · Auth Hold · Coding Hold · Submitted · Rejected · Adjudicated.

### DoD

One migration: re-add `claim_status_check` (14 states, confirm name, CHECK not enum) + `claim_lifecycle_event`

- `claim_scrub_result` + `scrub_rule` + `submission_channel` (GRANT + RLS by `tenant_members`, roles `biller`/`claims_officer`/`finance`/`tenant_admin`/`superadmin`); refresh trigger keyed off `authorization_request.status` / `authorization_item.decision`. New `claims/*` + masters routes; bulk returns per-row results; scrubber defines the new blockers in `src/lib/rcm/validation.ts` (reusing `AUTH_MISSING`); `ClaimsWorklistPane` wired into the real `rcm-claims` tab. `tsgo` green; Daylight only; halalas in mono; RTL-safe; no `clinical_role` ADD VALUE.