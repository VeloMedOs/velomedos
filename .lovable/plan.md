# Platform Governance · Round 1 (revised for repo facts)

## Plan-time psql — outputs (pasted, non-optional)

`**corporate_accounts**` (15 cols): `id, company_name, billing_ref, contact_email, contact_phone, owner_user_id, created_at, slug, logo_url, primary_color, accent_color, status, plan_tier, country, cluster_id`. No `display_name`, no `is_demo`, no `tenant_type`, no `lifecycle_status` — all three ADD are net-new (prompt claim of a pre-existing `is_demo`/`display_name` was wrong).

`**business_requests**` (41 cols) — already rich. Relevant to the review flow: `status text NOT NULL`, `stage business_request_stage NOT NULL`, `assigned_to uuid`, `converted_tenant_id uuid`, `source, source_detail, stage, assigned_to, expected_seats, estimated_value_cents, currency, converted_tenant_id, display_*`. Enum `business_request_stage`: `request | contacted | demo | prospect | lead | negotiation | subscribed | rejected | archived`.

`**platform_settings**` — **key/value shape**: `key text, value jsonb, updated_at, updated_by`. Existing keys: `branding`, `demo_public_reveal` (currently **true**), `limits`. Prompt's `ALTER TABLE ADD COLUMN demo_videos_enabled` is wrong — this must be a new row (`key='demo_videos_enabled', value='false'::jsonb`).

`**ops_security_settings**` — auth-hardening only (password/MFA/session/IP allowlist). `demo_public_reveal` does NOT live here; it lives in `platform_settings`. Prompt speculation corrected.

`**app_role` enum**: `admin, dispatcher, paramedic, driver, patient, developer, superadmin, business_admin, home_nurse, caregiver`. No `tenant_admin` — that's a `clinical_role`, distinct.

**Demo tenant**: `id=4b1916a1-5774-49f6-9c71-c5a38f165767`, `slug='demo-hospital'` (matches `DEMO_SLUG` in `src/lib/demo-seed.functions.ts:21`). Backfill target confirmed.

## Deviations from prompt (with rationale)

1. **Drop `M-GR1-03` review-workflow columns.** `business_requests` already has `stage` (enum) + `assigned_to` + `converted_tenant_id`. Adding `review_status` duplicates `stage`; adding `promoted_to_corporate_account_id` duplicates `converted_tenant_id`. Reuse existing columns; add only two: `reviewer_notes text`, `rejected_reason text` (nullable). Map Intake queue actions to existing `stage` transitions: `request → demo/contacted/negotiation → subscribed | rejected | archived`. Approval sets `stage='subscribed'` and populates `converted_tenant_id`.
2. `**M-GR1-05` becomes a row-insert migration, not `ADD COLUMN`.** `INSERT INTO platform_settings(key,value) VALUES ('demo_videos_enabled','false'::jsonb) ON CONFLICT (key) DO NOTHING;`. Server reads via existing key/value accessor.
3. `**M-GR1-06` unchanged** — `is_sandbox_tenant(uuid)` helper against new `corporate_accounts.tenant_type`.
4. `**business_requests` review columns collapsed** to just `reviewer_notes` + `rejected_reason`. Ships as one small migration.

Everything else in the prompt stands.

## Debt fence (LANDS FIRST)

`.lovable/plan.md` deltas — single `## Debt Register` header preserved:

- **#50 NEW** — Six Phases provisioning coordination (out-of-app infra). Owner: Six Phases.
- **#42 UPDATED** — 5 SMS stubs after Convention #27 restore (inter-company inline `interface_log` → `sendInterCompanyReferralNotification`; new `sendBusinessIntakeAcknowledgment`). Owner: gateway integration turn.
- **#49 PLACEHOLDER** — Demo Security Audit, pending investigation turn against Round 1 hardened surface. Owner: Investigation turn.
- Preserve #18–#23, #41, #43–#48 verbatim.

## Migrations (in order)

- **M-GR1-01** `tenant_type` enum (`production|sandbox|staging|archive`), column on `corporate_accounts` default `'production'`, backfill `sandbox` for id `4b1916a1-5774-49f6-9c71-c5a38f165767`, index.
- **M-GR1-02** `tenant_lifecycle` enum (`intake|evaluating|approved|provisioning|provisioned|active|suspended|terminated`), column default `'active'`.
- **M-GR1-03** `business_requests.reviewer_notes text`, `rejected_reason text` (both nullable). No new status columns.
- **M-GR1-04** `tenant_provisioning_request` table + GRANT + RLS (superadmin-only) + indexes (per prompt, unchanged).
- **M-GR1-05** `INSERT` `demo_videos_enabled=false` into `platform_settings` (ON CONFLICT DO NOTHING).
- **M-GR1-06** `is_sandbox_tenant(uuid)` SECURITY DEFINER helper + GRANTs.

## Sandbox isolation (Convention 33)

- `/api/admin/v1/demo/reset` + `/api/admin/v1/demo/seed`: reject `403 not_sandbox` unless resolved tenant is `is_sandbox_tenant(id)=true`.
- `/api/public/v1/demo/credentials`: **filter to `clinical_role='physician'` only** on the public path, regardless of `demo_public_reveal`. Superadmin / tenant_admin / cashier accounts never returned from the public route. Internal admin route (auth-required) retains full roster.

## Demo Tour + landing (Option A)

- New route `src/routes/demo-tour.tsx` — two Daylight cards: (1) Explore live (always), (2) Watch demos (renders only when `demo_videos_enabled=true`, disabled state when no videos exist).
- New `src/components/demo/BusinessIntakeModal.tsx` — 5-section form; maps extra UI fields (business_type, role, current_his, target_go_live, whitelabel_interest, interested_modules[]) into `use_case`/`notes` with `[Prefix: value]` markers. POSTs existing `/api/public/v1/business_intake`. Field-mapping extension flagged as Round 1.5 follow-up.
- New `src/components/demo/DemoBanner.tsx` — rendered in the authenticated shell; shows only when session tenant has `tenant_type='sandbox'`. `[Book a real demo]` opens modal; `[Exit demo]` = signOut + `/`.
- `src/routes/index.tsx` — add "Try Sandbox" (→ `/demo-tour`) + "Book a demo" (opens modal) CTAs. Existing marketing preserved.
- **Note**: an existing `src/components/DemoBanner.tsx` already exists (banner for demo-tenant sessions). Extend it — do not duplicate. It currently reads `corporate_accounts.is_demo` which doesn't exist; refactor to read `tenant_type='sandbox'` instead. This resolves a latent bug.

## SMS Convention #27 restore

`src/lib/interface/sms-gateway.ts`:

- Add `sendInterCompanyReferralNotification({tenant_id, phone_e164, lang, source_tenant_id, target_tenant_id, referral_id})` — signature matches existing stubs.
- Add `sendBusinessIntakeAcknowledgment({tenant_id, phone_e164, lang, contact_email, contact_name, request_id})`.

Refactor `src/routes/api/clinical/v1/opd/referral.inter-company.create.ts` to call the new stub instead of inline `interface_log.insert(...)`. Total = 5 stubs.

## Business Management pane

- `src/components/superadmin/BusinessManagementPane.tsx` with three tabs (Intake queue reading `business_requests WHERE stage IN ('request','contacted','demo','prospect','lead','negotiation')`, All businesses over `corporate_accounts`, Provisioning queue over `tenant_provisioning_request`).
- Nav tab `superadmin-businesses` in `nav-config.ts`; dispatch in `_authenticated/superadmin.tsx`.
- Row actions map to existing `business_requests.stage` transitions + `converted_tenant_id` on approval.

## Server routes (all pure-handler, envelope, capId-gated)

Under `src/routes/api/admin/v1/superadmin/`:

- `business-requests.list.ts` GET · `business-requests.$id.ts` GET · `business-requests.$id.approve.ts` POST · `business-requests.$id.reject.ts` POST · `business-requests.$id.mark.ts` POST
- `businesses.list.ts` GET · `businesses.$id.ts` GET · `businesses.$id.advance-lifecycle.ts` POST
- `provisioning.list.ts` GET · `provisioning.create.ts` POST · `provisioning.$id.acknowledge.ts` POST · `provisioning.$id.mark-provisioned.ts` POST · `provisioning.$id.mark-failed.ts` POST
- `platform-settings.get.ts` GET · `platform-settings.update.ts` PATCH

New capIds in `src/lib/clinical-role-matrix.ts`: `superadmin.businesses.read`, `superadmin.businesses.manage`, `superadmin.provisioning.read`, `superadmin.provisioning.manage`, `superadmin.platform_settings.manage` — all bound to superadmin only.

**Route-string discipline**: filenames drive route IDs (per Turn 3 closure). Every `createFileRoute("...")` matches its filename exactly — no `admin/admin/` duplication.

## Tests (target ≥237; baseline 221 + 16)

Files under `__tests__` alongside routes / lib:

- `tenant-type-sandbox-gate.test.ts` (4)
- `business-lifecycle.test.ts` (3)
- `business-requests-review.test.ts` (3) — driven by `stage` transitions, not a `review_status` column
- `provisioning-request.test.ts` (3)
- `platform-settings-videos-flag.test.ts` (1) — reads/writes `platform_settings` row via key
- `sms-stub-convention-27.test.ts` (2) — signature parity + inter-company route calls the stub

## Docs

`docs/his-technical-manual.md` — append "Platform Governance Round 1" section covering `tenant_type`, `lifecycle_status`, sandbox gate, demo-tour, Business Management pane, Convention 33, restored Convention #27.

## Definition of Done

- Debt register fence landed FIRST (single `## Debt Register` header)
- All 6 migrations applied (grants + RLS + backfill hitting demo tenant UUID)
- `/api/admin/v1/demo/{reset,seed}` return 403 `not_sandbox` when target isn't sandbox
- `/api/public/v1/demo/credentials` returns physician-only regardless of `demo_public_reveal`
- `/demo-tour` renders two cards; video card gated on `demo_videos_enabled` row
- `BusinessIntakeModal` posts to existing endpoint; success state visible
- `DemoBanner` reads `tenant_type='sandbox'` (existing bug against non-existent `is_demo` fixed)
- Landing has both CTAs
- Business Management pane functional over existing `business_requests.stage` transitions
- 15 superadmin routes shipped, capIds registered, filename ↔ route-string match
- Convention #27: 5 stubs; inter-company route no longer writes `interface_log` inline
- ≥237 tests green
- Grep gates: raw palette in new components = 0; `serviceClient|\.from\(` in daylight components = 0; `## Debt Register` = 1
- Route-tree smoke test (`src/routes/api/.../__tests__/route-url-resolution.test.ts` pattern) extended to cover new superadmin routes

## Plan verified — all 5 psql corrections confirmed against fresh clone `@0105f70`. Latent `DemoBanner.is_demo` bug real (line 20, 24-25 read a non-existent column, every current demo render silently fails); fix as planned. Three small clarifications before build:

**1. Superadmin route auth pattern.** New superadmin routes go under `/api/admin/v1/superadmin/`. Grep existing `/api/admin/v1/*` routes for their auth pattern (verified: `diagnostics.superadmin.ts` reads `user_roles.role='superadmin'`). Use that pattern, not `requireClinicalModule` (which is clinical-role-scoped). `clinical-role-matrix.ts` may not be the right home for the 5 new superadmin capIds — check whether it accepts `app_role='superadmin'` bindings; if not, register capIds against whatever the admin-role matrix is (or add both matrices for the same capId strings so `superadmin.businesses.manage` etc. resolve identically regardless of lookup path).

**2.** `has_role()` **helper is present** at migration line 39, signature `(uuid, public.app_role)`. Round 1's RLS policies using `has_role(auth.uid(), 'superadmin')` are safe — no additional helper needed.

**3. Note for Round 3 (not this round):** `corporate_accounts` currently has `logo_url, primary_color, accent_color` on the base table (per your psql). Round 3's `tenant_whitelabel` design should treat these as *overrides* not conflicts — the whitelabel table's `display_name`, `brand_primary`, `brand_secondary`, `brand_accent` override the corporate_accounts columns when the tenant has whitelabel entitlement. Design this cleanly in Round 3; nothing changes for Round 1.

**My VV2 retracted before shipping:** the interface_log assertion in the existing inter-company fixture (line 161) asserts on post-write state of `interface_log`. Since the new stub also writes to `interface_log`, the assertion holds identically. Refactor is clean; no test regression.

Proceed to build. Post-build report expected; I'll verify against fresh clone + spot-check the DemoBanner refactor, the demo tenant backfill, the physician-only public credentials filter, and the SMS stub signature parity.

### After Round 1 lands

Then paste the Demo Security Audit prompt (already prepared as `Demo_Security_Audit_Prompt_v1.0.md`) against the hardened surface. Findings should be substantially reduced by:

- Public path serving physician role only (superadmin no longer publicly reachable)
- Demo routes gated on `tenant_type='sandbox'`
- Persistent banner + exit-demo affordance

The audit becomes a "did we get the hardening right?" pass rather than a discovery of surprises.

**Watchlist for post-build validation of Round 1:**

1. Demo tenant row has `tenant_type='sandbox'` (backfill hit the right UUID)
2. `DemoBanner.tsx` refactored to read `tenant_type='sandbox'`, not `is_demo` (latent bug fixed)
3. Public demo credentials returns physician-only regardless of `demo_public_reveal` state (fixture asserts this specifically)
4. Convention #27 restore: `sms-gateway.ts` has 5 stubs with matching signatures; inter-company route no longer has inline `interface_log.insert(...)`
5. Superadmin routes match filename↔createFileRoute-string discipline (Convention #31)
6. Register single-hit with #50 opened, #42 updated, #49 placeholder  
  
**Follow-ups (out of Round 1 scope)**

- Round 1.5 schema extension for the intake modal's structured fields (business_type, role, current_his, target_go_live, whitelabel_interest, interested_modules[]) — currently prefix-encoded into `use_case`/`notes`.
- Round 2 — tiered pricing catalog (ApplicationPMO Call A).
- Round 3 — white-label triple (rename + logo + domain + email identity) (Call C).
- Post-Round-1 — Demo Security Audit investigation turn against the hardened surface.
## Debt Register

- **#18** — Rule C series therapy seeding. Open.
- **#19** — BRS to confirm `approx_perform_minutes` vs `tat_minutes`. Open.
- **#20** — `visit_type` naming divergence. Open.
- **#21** — `maternity_protocol.next_anc_due_at` missing (literal cadence in place). Open.
- **#22** — `referral_network` table needed before external write path (skeleton shipped Turn 1). Open.
- **#23** — Portal self-booking compat layer. Open.
- **#41** — ZATCA credit-note linkage. Owner: VAT engine turn. Open.
- **#42** — SMS gateway integration. **5 stubs after Round 1** (`sendPreauthUpdate`, `sendVisitConfirmation`, `sendBulkCancelNotification`, `sendInterCompanyReferralNotification`, `sendBusinessIntakeAcknowledgment`) — Convention #27 restored (inter-company no longer writes `interface_log` inline). Owner: gateway integration turn. Open.
- **#43** — D7 form bindings. Open.
- **#44** — Hijri calendar (HCA-0051, E2b placeholder in place). Open.
- **#45** — Referral write endpoints. **RESOLVED (Step 5 Turn 2).**
- **#46** — Surgery/OR referral target: fan-out returns `422 target_kind_not_ready`; no `surgery_booking` table yet. Owner: **Batch C_05 OR**. Open.
- **#47** — HCA-1010 audit-log-backed TAT (currently derived from `referral_target.updated_at`). Owner: audit-log spine. Open.
- **#48** — CSV streaming for large date ranges. `referral.report[.]csv.ts` materialises the whole CSV in memory. Migrate to `ReadableStream` row-at-a-time chunking when a report crosses ~10K rows in practice. Owner: performance turn. Open.
- **#49** — Demo Security Audit — placeholder. Pending investigation turn against Round 1 hardened surface. Owner: Investigation turn.
- **#50** — Six Phases provisioning coordination (out-of-app infrastructure handoff for `tenant_provisioning_request`). Owner: Six Phases infrastructure.

Parked: **#14 / #35** (QMS token spine — QMS batch), **#36** (referral cockpit — resolved across Step 5 Turns 1/2/3).

## Round 1 · Batch 1 shipped (foundation)

- **Migrations** — `tenant_type` / `tenant_lifecycle` enums + columns on `corporate_accounts`; existing demo tenant backfilled to `sandbox`; `business_requests.reviewer_notes`; `tenant_provisioning_request` table (superadmin-gated RLS); `platform_settings.demo_videos_enabled` row; `is_sandbox_tenant()` helper.
- **SMS gateway stubs (Convention #27 restored)** — added `sendInterCompanyReferralNotification` + `sendBusinessIntakeAcknowledgment`. Inter-company referral route + public business_intake route now route through stubs (no inline `interface_log` writes).
- **Demo isolation** — `DemoBanner` reads `tenant_type === 'sandbox'` (drop of legacy `is_demo`). `resolveDemoTenant()` refuses to touch any tenant not tagged sandbox even when the slug matches (`not_sandbox_tenant` guard) — reset/seed cannot mis-target a production tenant.
- **Tests** — 221 pass unchanged. 5 pre-existing Playwright specs surface an unhandled `test.describe` warning under `bun test`; not touched by this batch.

### Batch 2 (next turn) — deferred

- `/demo-tour` route + `BusinessIntakeModal` component (public surfaces).
- `BusinessManagementPane` (superadmin) with Intake / All Businesses / Provisioning tabs.
- Superadmin routes for `tenant_provisioning_request` CRUD + business-request advance flow.
- Public physician-only filter on demo credentials roster.
