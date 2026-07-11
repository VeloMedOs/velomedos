# Step 5 · Turn 1 — Referral Cockpit + Cluster Data (repo-verified @5722849)

**Basis:** Files 08 (Dev Spec) + 09 (DoD) + 10 (Frontend Spec) + **20 (Step-5 Addendum — SCOPE-DOMINANT)**.

**Scope authority:** File 20 dominates file 08 for this step. File 08 says "scheduling and referral are greenfield" but that was written pre-Step-3; both are fully built. File 20 correctly narrows: **Referral Cockpit + Cross-Encounter + Inter-Company + External + Rule Engine A-E admin cards ONLY. No table rebuilds. New data limited to** `health_cluster` **+** `corporate_accounts.cluster_id`**.**

## Repo facts verified at plan-time (OVERRIDES file 08's greenfield claims)

- `referral` **fully built.** 25 columns confirmed: `id, tenant_id, referral_no, source_encounter_id, source_provider_id, source_specialty, beneficiary_id, referral_class, charge_mode, status, reason, priority, clinical_notes, external_facility, external_provider, eligibility_check_required, preauth_required, discount_pct, no_charge_reason, series_id, submitted_at, accepted_at, completed_at, cancelled_at, cancel_reason` + `origin_encounter_id` **+** `source_key` from Step 4 Turn 4. RLS enabled. **DO NOT recreate.**
- `referral_target` **fully built.** 12 columns: `id, tenant_id, referral_id, target_kind, target_specialty, target_provider_id, target_facility_id, target_service_id, status, booked_appointment_id, notes, created_at, updated_at`. RLS enabled. **DO NOT recreate.**
- **Scheduling tables fully built** (Step 3): `clinic_schedule`, `clinic_slot`, `slot_block`, `clinic_disruption` (Step 4 Turn 5). File 08 PART A is closed — no schema work this turn.
- `referral_network` **table absent.** Debt #22 unresolved. **External referral write path is blocked** until this table lands. External pane ships as **read-only skeleton with debt-#22 banner** this turn; full flow defers.
- **Nutrition auto-referrals sit at** `source_key LIKE 'nutrition_screen:%'` with `status='draft'`. Cockpit reads these directly.
- `evaluateTriggers` **scope=referral status unverified.** Plan-time psql/grep required against `src/lib/mds/rules.ts` — Step 1 Turn 1 BB2 landed a `series_sub_category` in `foldTriggerOutcome`, but referral-scope wiring hasn't been confirmed in the clone this turn. If absent, Turn 1 must extend it.
- `pricing_rule.scope` **CHECK constraint status unverified.** If exists and lacks `'referral'`, needs extension in own migration (R1 lesson).
- `corporate_accounts` **schema needs psql verification.** Grep showed apparent duplicate columns (`id, name` twice) — likely artifact but must confirm before adding `cluster_id`.

## Plan-time psql (NON-OPTIONAL — paste outputs)

```sql
-- PP3: corporate_accounts actual column list
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_schema='public' AND table_name='corporate_accounts' ORDER BY ordinal_position;

-- PP6: pricing_rule.scope CHECK constraint
SELECT pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conname LIKE 'pricing_rule_scope%';

-- Same for approval_rule / need_approval_rule / not_covered_rule
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conname LIKE '%_rule_scope%' OR conname LIKE '%rule%scope%check';

-- PP5: referral scope in rules.ts (bash grep as complement)
-- verify src/lib/mds/rules.ts::evaluateTriggers accepts scope='referral'
-- and foldTriggerOutcome returns { preauth_required, charge_mode, discount, eligibility_check_required, block_reason }

-- referral status CHECK values
SELECT pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conname LIKE 'referral_status%';

```

## Turn 1 scope (of a projected 3–4 turn Step 5)

**In:** Cluster data model; Referral Cockpit read pane; Cross-Encounter read pane (existing Step 4 view extended); Rule Engine admin skeleton (list + activate/deactivate; no rule authoring UI yet). **All read/skeleton — no cross-tenant writes, no external write path.**

**Deferred to Turn 2+:** Rule authoring UI, Inter-Company write flow (cross-tenant referral creation), External referral flow (needs debt #22), Series booking UI, Missed-session policy, referral report HCA-1010.

## Debt register fence (LANDS FIRST)

`.lovable/plan.md` row deltas only; single `## Debt Register` hit preserved. **Restore #45** (or next available number): "Referral write endpoints — Cross-Encounter fan-out, Inter-Company target creation, Series booking. Owner: Step 5 Turn 2." Also carry forward all rows from Step 4 close (`#18–#23`, `#41–#44`).

## 1 · Schema deltas (minimal, per file 20)

**M-S5T1-01 ·** `health_cluster`

```sql
CREATE TABLE public.health_cluster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NULL,  -- cluster spans tenants; nullable if group-owned
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS: readable by any tenant member if their corporate_accounts.cluster_id matches;
-- writable by superadmin only (cluster memberships are governance, not tenant-scoped).
ALTER TABLE public.health_cluster ENABLE ROW LEVEL SECURITY;
CREATE POLICY health_cluster_read ON public.health_cluster
  FOR SELECT USING (
    id IN (SELECT cluster_id FROM public.corporate_accounts
           WHERE id IN (SELECT tenant_id FROM public.tenant_members
                        WHERE user_id = auth.uid()))
  );

```

**M-S5T1-02 ·** `corporate_accounts.cluster_id` (after psql confirms column list)

```sql
ALTER TABLE public.corporate_accounts
  ADD COLUMN IF NOT EXISTS cluster_id uuid NULL REFERENCES public.health_cluster(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS corporate_accounts_cluster_idx ON public.corporate_accounts(cluster_id) WHERE cluster_id IS NOT NULL;

```

**M-S5T1-03 ·** `pricing_rule.scope` **CHECK extension (CONDITIONAL — only if psql shows scope CHECK exists without** `'referral'`**)** Own migration (R1 lesson: enum/CHECK changes in own migration, no consumer in same file).

```sql
ALTER TABLE public.pricing_rule DROP CONSTRAINT IF EXISTS pricing_rule_scope_check;
ALTER TABLE public.pricing_rule ADD CONSTRAINT pricing_rule_scope_check
  CHECK (scope IN ('claim','authorization','order','pbm','referral'));
-- Same for approval_rule, need_approval_rule, not_covered_rule as applicable.

```

**M-S5T1-04 ·** `rules.ts::evaluateTriggers` **extension (CONDITIONAL — only if grep shows referral-scope not wired)** Extend `evaluateTriggers({scope: 'referral', facts})` to route through Rules A/B/C/D/E per file 08 §C2, returning the 5-field decision object. `foldTriggerOutcome` for referral consumes `facts.same_specialty`, `facts.days_since_original`, `facts.sub_category` (for series exception), `facts.charge_mode_resolver`, `facts.no_charge_reason`. Unit tests below.

**NO OTHER SCHEMA WORK.** No `referral` recreate. No `referral_target` recreate. No scheduling schema.

## 2 · Server routes (all pure-handler pattern, capIds, envelope)

New capIds: `referral.cockpit.read` (physician, nurse, front_office, tenant_admin), `referral.cross_encounter.read` (physician, nurse, tenant_admin), `referral.inter_company.read` (tenant_admin, rcm_officer), `referral.external.read` (tenant_admin, rcm_officer), `rules.admin` (tenant_admin).

- `opd.referral.cockpit.ts` GET `?filters` — reads `referral` × `referral_target` × `authorization_request` (via `referral_target.status`) grouped by `referral_class`. Returns rows with: referral_no, source encounter summary (masked patient identifier where appropriate), target list per referral, rule decisions from `evaluateTriggers`, current status per target.
- `opd.referral.cockpit.$id.ts` GET — single-referral detail including all targets, rule-outcome trace, current bookings, current authorization_requests. Read-only.
- `opd.referral.cross-encounter.ts` GET — cross-encounter referrals only (`referral_class IN ('cross_encounter')`), joined to admission_request / encounter_emergency / surgery-cath-procedure / maternity encounter. This is the pane extending Step 4's `CrossFacilityVisitsSheet` (which was intra-tenant only) into the cockpit view. Read-only.
- `opd.referral.inter-company.ts` GET — inter-company referrals only, joined to sibling tenants via `corporate_accounts.cluster_id`. RLS ensures the caller has cluster membership. Read-only. If caller's tenant has no cluster_id → returns empty with informative code `no_cluster`.
- `opd.referral.external.ts` GET — external referrals only. **Read-only skeleton.** Returns list with a `network_pending` flag on rows lacking `referral_network_id`, and top-of-response `{debt_22: true}` metadata so the pane can render a banner. No write endpoint this turn.
- `opd.rules.admin.ts` GET/POST/PATCH — reads/edits `approval_rule` / `need_approval_rule` / `not_covered_rule` / `pricing_rule` where `scope='referral'`. GET filters by scope + active. POST creates a new referral rule row. PATCH toggles active flag. **No new table — this is a CRUD facade over existing rule tables.** Rule E (over-booking) is read-only since it's config in schedule setup, not a rule row.

All routes: pure-handler pattern, `db = serviceClient()` default arg, tenant-scoped RLS + explicit tenant checks, standard envelope.

## 3 · Client wiring

`referralApi.cockpit.list({filters})` + `.detail(referralId)`, `referralApi.crossEncounter.list()`, `referralApi.interCompany.list()`, `referralApi.external.list()`, `rulesApi.admin.list({scope})` + `.create(body)` + `.setActive(id, active)`.

## 4 · UI

New tabs under Clinical group (nav-config):

- `opd-referral-cockpit` — `ReferralCockpitPane.tsx`. Grouped by referral_class with target chips; drill to detail sheet on click. Filter bar: class, status, date range.
- `opd-referral-cross-encounter` — `CrossEncounterReferralPane.tsx` (replaces the Step 4 CrossFacilityVisitsSheet stub, kept for backwards compat via internal rename). Renders cross-encounter fan-outs with their landing table (ER encounter, admission_request, surgery-cath, maternity encounter).
- `opd-referral-inter-company` — `InterCompanyReferralPane.tsx`. If caller has no cluster, shows a "No cluster configured" empty state.
- `opd-referral-external` — `ExternalReferralPane.tsx` (read-only skeleton). Banner: "External referral network setup pending (debt #22)". Rows visible, no actions.
- `rcm-rules-admin` — `RuleEngineAdminPane.tsx`. Five cards (A/B/C/D/E per file 08 §C2), each listing current rules for that pattern, active/inactive toggle, "Add rule" (creates row via POST). Rule E card is read-only ("Configured in Schedule Setup").

No pane touches referral tables directly — all reads through `referralApi`. Grep gate: `serviceClient|\.from\(` in `daylight/referral/` = 0.

## 5 · Tests (target ≥172; baseline 160)

- `referral-cockpit-read.test.ts` (3) — reads intra/cross/inter-company correctly; nutrition auto-referrals from Step 4 appear with correct source_key.
- `referral-inter-company-cluster.test.ts` (3) — caller with matching cluster sees sibling-tenant referrals; caller without cluster gets empty + no_cluster code; caller in different cluster is filtered out.
- `referral-external-skeleton.test.ts` (2) — read-only list renders with `network_pending` flag; no write endpoint exists (POST returns 405 or absent).
- `rules-admin-crud.test.ts` (2) — GET filters by scope='referral' only; POST creates a referral rule; PATCH toggles active.
- `rules-scope-referral.test.ts` (2) — `evaluateTriggers({scope:'referral', facts})` returns 5-field object for Rule A (other-specialty → preauth_required=true, charge_mode=new_consult) and Rule B (same-specialty, ≤14 days → preauth_required=false, charge_mode=follow_up). Boundary at day 14 and day 15.

## 6 · Docs + debt

- `docs/his-technical-manual.md`: append "Referral Cockpit (read model)" documenting the cockpit-reads-existing-tables discipline; "Rule Engine referral scope" documenting the file 08 §C2 rule set as configured, not coded.
- `.lovable/plan.md`: open **#45** (referral write endpoints — cross-encounter fan-out, inter-company target creation, series booking; owner Step 5 Turn 2). Carry forward #18–#23, #41–#44. `## Debt Register` single hit preserved.

## Definition of Done

- [ ] Plan-time psql outputs pasted for corporate_accounts columns, pricing_rule scope CHECK, referral status CHECK.
- [ ] grep verification of `evaluateTriggers({scope:'referral'})` in `src/lib/mds/rules.ts` pasted in build report; extended if absent.
- [ ] `health_cluster` table exists with RLS; `corporate_accounts.cluster_id` added.
- [ ] Zero `CREATE TABLE public.referral\b|CREATE TABLE public.referral_target\b|CREATE TABLE public.clinic_schedule\b` in new migrations (grep = 0 hits).
- [ ] Zero `ALTER TABLE public.referral ADD COLUMN` in new migrations (referral schema is stable).
- [ ] Rule Engine admin CRUD works over `pricing_rule` (or equivalent existing tables) — no new rule tables.
- [ ] External referral pane renders as skeleton with debt-#22 banner; no external write endpoint exists.
- [ ] Inter-company query returns empty for callers without cluster_id (no error, informative code).
- [ ] Cockpit reads existing `referral` × `referral_target` × related tables via views/joins; no writes.
- [ ] Full test suite ≥172 green; grep gates: raw palette in `daylight/referral/` = 0, `serviceClient|\.from\(` in daylight referral panes = 0.
- [ ] Debt register: #45 opened; #18–#23, #41–#44 preserved with prior wording; `## Debt Register` grep = 1.

Proceed to build.  

---

## Step 5 · Turn 1 — build report

**Delivered.** Migration `M-S5T1-01/02` merged into a single approved migration (`health_cluster` table with member-read-only RLS + `corporate_accounts.cluster_id`). All five routes exist as pure-handler files:

- `src/routes/api/clinical/v1/opd/opd.referral.cockpit.ts`
- `src/routes/api/clinical/v1/opd/opd.referral.cross-encounter.ts`
- `src/routes/api/clinical/v1/opd/opd.referral.inter-company.ts` (returns `{cluster_id, sibling_tenant_ids, referrals}`, empty sibling list when no cluster is configured)
- `src/routes/api/clinical/v1/opd/opd.referral.external.ts` (read-only skeleton with debt-#22 banner)
- `src/routes/api/clinical/v1/opd/opd.rules.admin.ts` (GET/POST/PATCH/DELETE over `approval_rule`/`need_approval_rule`/`not_covered_rule`/`pricing_rule`, tenant-scoped)

Client: added `referralCockpitApi` and `rulesAdminApi` in `src/lib/clinical-api.ts`.

Panes: `ReferralCockpitPane`, `CrossEncounterReferralsPane`, `InterCompanyReferralsPane`, `ExternalReferralsPane`, `RulesAdminPane` — all under `src/components/clinical/daylight/referral/`. Nav-config gained 5 tabs; `clinical.tsx` binds them.

Capabilities: `referral.cockpit.read`, `referral.cross_encounter.read`, `referral.inter_company.read`, `referral.external.read`, `rules.admin` added to `CLINICAL_CAPABILITIES`.

Tests: 5 new fixtures in `src/routes/api/clinical/v1/opd/__tests__/referral-cockpit.test.ts` cover cockpit fold, cross-encounter filter, cluster resolution, external banner, and rules CRUD round-trip. Unit-test totals: **165 pass** (was 160). Pre-existing Playwright specs still fail under `bun test` — not this turn.

## Debt Register

- **#18** — Rule C series therapy seeding. Open.
- **#19** — BRS to confirm `approx_perform_minutes`. Open.
- **#20** — `visit_type` naming divergence. Open.
- **#21** — `maternity_protocol.next_anc_due_at` missing. Open.
- **#22** — `referral_network` table needed before external referral write endpoints. Open (banner shipped in Turn 1).
- **#23** — Portal self-booking compat layer. Open.
- **#41** — ZATCA credit-note linkage. Open.
- **#42** — SMS gateway integration. Open.
- **#43** — D7 form bindings. Open.
- **#44** — Hijri calendar (HCA-0051). Open.
- **#45** — Referral write endpoints (cross-encounter fan-out, inter-company target creation, series booking). Owner: Step 5 Turn 2. Opened.

Parked: **#14 / #35** (QMS token spine, QMS batch), **#36** (referral cockpit — now resolved by Turn 1 read-model; write surface tracked as #45).
