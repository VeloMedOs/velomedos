# RCM R1–R7 plan — amendments (Chunk 1 / R1 focus)

The chunking strategy is right (PR-sized, sign-off-gated, standing DoD), and Chunk 1 is faithful to the R1 spec — partial-unique eligibility, financial-type lock, the 19-step SM, the governed change-request audit, and the Phase-10 hard-block are all correct. Four things to fix before shipping R1; one is a migration bug that will fail outright.

## [FIX — CRITICAL, will fail] §1 enum value + RLS policy in the same migration

The migration adds `clinical_role + front_office` **and** creates RLS policies "gated to … front_office" in the same transaction. Postgres throws **"unsafe use of new value"** when a newly-added enum label is used in the same transaction that added it — and Supabase wraps each migration in one transaction. So a policy referencing `'front_office'::clinical_role` (or a CHECK/DEFAULT using it) in this migration fails. Fix:

- Add any missing `clinical_role` values in a **separate, earlier migration** containing only `ALTER TYPE … ADD VALUE IF NOT EXISTS` statements (one per value), nothing that uses them.
- **First verify what already exists** — the HIS access-entry enum-expand migration was specced to add all five (`front_office`, `rcm`, `approval_officer`, `claims_officer`, `finance`). The plan assumes only `rcm`/`approval_officer` exist; if the expand already ran, `front_office` is present and this step is a no-op (the `IF NOT EXISTS` keeps it safe). Don't add values piecemeal across chunks — confirm the enum once against the live DB, then never reference a value in the same migration that introduces it.

## [FIX] §2 Don't fork a second NPHIES transport

The plan both adds `submitEligibility(...)` to the Phase-9 gateway **and** creates `src/lib/rcm/eligibility-gateway.ts`. Pick one transport: eligibility rides the **shared, message-aware Phase-9 gateway** (the one reframed from claim-only to `$process-message` for eligibility/auth/claim/ remittance/PRM). `eligibility-gateway.ts` should be a thin **bundle builder** (assemble the CoverageEligibilityRequest, parse the response) that *calls* the shared gateway — not its own sandbox/transport. Otherwise the `is_demo` sandbox-forcing and the inbound router live in two places and drift. Confirm the gateway path matches where Phase 9 actually placed it (`src/lib/nphies/gateway.ts`), not `src/lib/mds/nphies/gateway.ts`.

## [FIX] §3 Reconcile the matrix module — don't add an overlapping one

The plan adds a **new** `Eligibility & Contracts` module to `clinical-role-matrix.ts` with `elig.check / elig.exception / elig.activate / contract.manage / contract.change`. But the shipped matrix already has `Registration & Eligibility` (`reg.beneficiary`, `reg.eligibility`, `reg.activation`) and `Masters & Contracts` (`mast.contracts`). Two modules covering eligibility will confuse the guard, the simulator, and the privileges UI. Instead:

- Extend `Registration & Eligibility` with `elig.check`, `elig.exception`, `elig.activate` (or map onto the existing `reg.eligibility`/`reg.activation` caps).
- Extend `Masters & Contracts` with `contract.manage` / `contract.change`. Keep the module set coherent — the matrix is the SSOT the route map is CI-checked against.

## [VERIFY] §1 `insurance_class + network_id` vs the Phase-3 class→plan→network chain

Phase 3 modeled the chain `policy → class → plan → network` (+ `network_membership`). Adding a direct `insurance_class.network_id` FK asserts class↔network is 1:1. If a class can map to multiple networks (via plans), this FK is redundant or contradictory. Confirm the cardinality against the P3 schema before adding it; if it's many, resolve network through the existing chain rather than a direct column. Same check for the duplicated limit/deductible/room_type fields appearing on **both** `insurance_class` and `network` — define the precedence (class overrides network, or vice-versa) so the resolver isn't ambiguous.

## [VERIFY] §3 `ops_notifications` exists

The `policy-activations.$id.notify.ts` "notify originating receptionist via `ops_notifications`" assumes that table exists (mobility side). Confirm it's present and tenant-scoped; if not, create it (tenant_id + RLS) in this migration rather than referencing a table that isn't there.

## Minor

- Guard naming: use the `requireClinicalModule` that dispatches read-vs-write by method (read-permissive GET, write-gated) per the access-entry/privileges work — keep it consistent, don't reintroduce bare `requireClinicalRole([...])` for the new routes.
- §1 partial-unique on `visit_eligibility`: `UNIQUE (encounter_id) WHERE status <> 'cancelled'` is the intent — make sure it's a partial **unique index**, not a constraint (Postgres can't put a WHERE on a table constraint).
- Money in halalas everywhere — the plan says so; just confirm the new `*_minor` columns (deductible jsonb may hold amounts → document the unit inside the JSON too).

## Good as written

The chunk-per-PR cadence, the 19-step `eligibility-sm.ts` as pure functions, the governed `contract_change_request` (draft→approved→applied with before/after JSONB), the Phase-10 `eligibility_lifecycle_ok` hard-block, read-only UI this phase, and "don't touch R2–R7 surfaces" are all the right calls. With the enum migration split out, the single shared gateway, and the matrix module reconciled, **R1 is good to ship** — reply "go R1" after those three are folded in.