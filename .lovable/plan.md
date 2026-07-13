## Round 1 · Batch 2 — Panes + `/demo-tour` + intake modal + is_demo cleanup

Baseline: 224 unit green (Batch 1 close). Target ≥237 (+13).

### Auth pattern for new admin routes (Batch2-W1)

All new superadmin endpoints use the established pattern from `src/routes/api/admin/v1/business-requests.ts`:

```ts
const auth = await requireAdmin(request, "subscribers:write");
if (!auth.ok) return auth.res;
```

`requireAdmin` (in `src/lib/api-admin.ts`) already accepts either a scoped `x-admin-key` OR a signed-in portal-staff session validated via `is_portal_staff` RPC — no `clinical-role-matrix` change needed, no new capIds. Scope map:

- Read intake queue / all businesses / provisioning queue → `subscribers:read`
- Advance stage / convert / provision / suspend → `subscribers:write`
- Reviewer notes write → `subscribers:write`

`app_role='superadmin'` is checked by `is_portal_staff` at the DB layer; the route only asks for the scope. This mirrors every existing `/api/admin/v1/*` route.

### 1. `/demo-tour` route (2 Daylight cards)

`src/routes/demo-tour.tsx` — public marketing route. Two cards:

- **Sandbox Login** — links to `/demo-login`, physician-only roster copy.
- **Guided Video Walk-Through** — conditional on `platform_settings` where `key='demo_videos_enabled'` and `value->>'enabled' = 'true'` (Batch2-W2: `.value.enabled` jsonb access, not `.value`). When disabled, card renders "Coming soon" state.

Reader lives in a new `src/lib/platform-settings.functions.ts` server fn that returns `{ demo_videos_enabled: boolean }` by reading `value->'enabled'`. Route uses TanStack Query loader shape.

`head()` sets title/description/og; no og:image.

### 2. `BusinessIntakeModal` (5-section form)

`src/components/marketing/BusinessIntakeModal.tsx`:

- Sections: **Company** (name, legal, CR, VAT), **Contact** (name, email, phone, role), **Operations** (business_type, current_HIS, fleet_size, expected_seats), **Goals** (target_go_live, whitelabel_interest, interested_modules[]), **Notes** (use_case, source_detail).
- Structured-prefix encoding into `notes` field (the extra fields don't exist as columns; encoded as `\nbusiness_type: opd\ncurrent_HIS: none\ntarget_go_live: 2026Q4\nwhitelabel_interest: yes\ninterested_modules: opd,ipd,rcm` appended to freeform notes).
- POSTs to existing `/api/public/v1/business_intake`. No schema migration; endpoint unchanged.
- Zod validation client-side; success card shows `reference_code`.

### 3. `BusinessManagementPane` (3 tabs)

`src/components/superadmin/BusinessManagementPane.tsx` — replaces the direct `<PipelineBoard />` mount for the "requests" tab in `src/routes/_authenticated/superadmin.tsx`. Three sub-tabs:

**Tab A — Intake queue**

- Reads `GET /api/admin/v1/business-requests?stage=<in-flight>` (repeated with `stage` filter across `request|contacted|demo|prospect|lead|negotiation`).
- Row actions: Advance stage (existing `POST .../$id/advance`), Add reviewer notes (NEW `PATCH .../$id/reviewer-notes`), Convert (existing `.../$id/convert`).

**Tab B — All businesses**

- `GET .../business-requests` unfiltered + free-text search across company_name / contact_email.
- Read-only lifecycle chip (`corporate_accounts.tenant_lifecycle`) resolved by NEW `GET .../superadmin/tenants` list route.

**Tab C — Provisioning queue**

- Reads NEW `GET .../superadmin/provisioning` over `tenant_provisioning_request` table (created in Batch 1, RLS: superadmin-only).
- Row actions: Approve (moves lifecycle `provisioning → active`), Suspend (`active → suspended`), Archive (`* → archived`).
- Lifecycle state machine per Batch 1 ratified enum (`intake → provisioning → active`, with `suspended`/`archived` terminal).

### 4. New superadmin routes (14, all pure-handler + `.ts` fixture-registered)

Under `src/routes/api/admin/v1/superadmin/`:

1. `provisioning.ts` — `GET` list, `POST` create (row over `tenant_provisioning_request`).
2. `provisioning.$id.ts` — `GET` detail, `PATCH` reviewer_notes/decision.
3. `provisioning.$id.approve.ts` — `POST` → sets `corporate_accounts.tenant_lifecycle='active'`, updates request status.
4. `provisioning.$id.reject.ts` — `POST` → sets provisioning request status='rejected'.
5. `tenants.ts` — `GET` list of `corporate_accounts` with `tenant_type`, `tenant_lifecycle`, `company_name`.
6. `tenants.$id.suspend.ts` — `POST` → lifecycle `active → suspended`.
7. `tenants.$id.reactivate.ts` — `POST` → lifecycle `suspended → active`.
8. `tenants.$id.archive.ts` — `POST` → lifecycle `* → archived`.
9. `tenants.$id.promote.ts` — `POST` → `tenant_type` `sandbox → partner` or `partner → production` (Round 1 v2 promotion path).
10. `business-requests.$id.reviewer-notes.ts` — `PATCH` writes `reviewer_notes` (new col from Batch 1 migration).
11. `platform-settings.ts` — `GET` list all settings, `PATCH` upsert single key.
12. `platform-settings.demo-videos.ts` — `POST` toggle `demo_videos_enabled.value.enabled` (convenience wrapper).
13. `intake.stats.ts` — `GET` stage/source counts over `business_requests` for pane header.
14. `provisioning.stats.ts` — `GET` counts by lifecycle for pane header.

All use `requireAdmin(request, "subscribers:read|write")`. All emit `adminAudit(...)`.

### 5. `DemoBanner` CTAs

Extend `src/components/DemoBanner.tsx`:

- **Book a real demo** button → opens `BusinessIntakeModal` (portal via lifted state, or navigate to a route param that opens it — pick modal via query param `?intake=1` on current path).
- **Exit demo** button → `supabase.auth.signOut()` → navigate `/`.
- Banner remains sticky and only visible for `tenant_type='sandbox'` (unchanged detection from Batch 1).

### 6. Landing page CTAs

`src/routes/index.tsx` closing CTA (line 273 area) + hero:

- **Try Sandbox** → `<Link to="/demo-tour">`.
- **Book a demo** → button that mounts `BusinessIntakeModal` (replaces current `<Link to="/demo">`; the old `/demo` form route stays as a fallback deep-link).

### 7. `src/lib/demo-mode.ts` `is_demo` cleanup (WW2 fold)

Rewrite `isDemoTenant()` to read `tenant_type='sandbox'` instead of `is_demo` boolean. Same signature, same TTL cache. `getDemoTenantId()` unchanged (already keys on slug).

### 8. Wiring

- `SuperTabId` in `src/components/superadmin/SideNav.tsx`: rename `requests` label to "Business Management" (id stays `requests` to avoid churn). No new tab needed — same slot, richer pane.
- `src/routes/_authenticated/superadmin.tsx` line 394-395: swap `<PipelineBoard />` for `<BusinessManagementPane />`. `PipelineBoard` kept as a sub-view rendered inside Tab A for backwards compat.

### 9. Tests (+13 minimum → 237)

- `superadmin-provisioning-flow.test.ts` (4): approve/reject/suspend/reactivate transitions with `requireAdmin` mock.
- `superadmin-tenants-promote.test.ts` (2): sandbox→partner, partner→production; rejects invalid transitions.
- `platform-settings-jsonb.test.ts` (2): reads `.value.enabled` shape correctly; toggle updates jsonb wrapper not bare bool.
- `business-intake-modal-encoding.test.ts` (2): structured prefixes encode into `notes`; endpoint payload matches existing schema.
- `demo-mode-tenant-type.test.ts` (2): sandbox tenant → true; non-sandbox → false; envForce still respected.
- `demo-tour-video-flag.test.ts` (1): card hidden when `enabled=false`, shown when true.

### 10. Debt register

- Close: #49 (placeholder), #50 (opened this round for Batch 2 delivery).
- Update: #42 (demo mode legacy flag) — resolved by WW2 fold.
- Preserve all prior rows #18–48.

### Non-goals (out of scope, defer)

- Actual video player + hosting (only the flag-gated card shell lands).
- Email/SMS notifications on provisioning transitions (Convention #27 stubs added if trivial; otherwise deferred to next batch).
- Tenant self-service portal for provisioning requests (superadmin-only path this round).

### Plan verified against fresh clone `@a7887eb`. `requireAdmin` + `subscribers:read|write` scope pattern confirmed correct (existing 5+ business-requests routes use it verbatim), `is_portal_staff` helper present, PipelineBoard swap target real, `is_demo` residues confirmed in the 3 locations flagged. Four tightenings before build:

**1.** `demo-mode.ts` **rewrite must preserve** `getDemoTenantId()` **slug lookup.** Plan says "unchanged" — verify. `isDemoTenant(tenant_id)` reads `tenant_type='sandbox'` for the given UUID. `getDemoTenantId()` continues querying by `slug=DEMO_SLUG` but adds a defensive check: reject if returned row's `tenant_type !== 'sandbox'`. This catches future migrations that might mis-tag the demo slug.

**2. Reviewer notes — extend existing PATCH, don't create a new route.** Route #10 as designed puts reviewer_notes under `/api/admin/v1/superadmin/business-requests/$id/reviewer-notes` while all other business_requests PATCHes are at `/api/admin/v1/business-requests/$id` — URL split makes reviewer-notes look like a different resource. Extend `src/routes/api/admin/v1/business-requests.$id.ts` line 43 PATCH handler to accept `{reviewer_notes}` in the body (3-line change). Route count: 13 not 14.

**3. Route-URL smoke fixture must include all new admin URLs.** Add to `EXPECTED_URLS` in `src/routes/api/clinical/v1/opd/__tests__/route-url-resolution.test.ts` (or wherever the fixture lives now — verify path). Both `/api/admin/v1/superadmin/platform-settings` and `/api/admin/v1/superadmin/platform-settings/demo-videos` distinct URLs; both need coverage.

**4. Superadmin routes use** `requireAdmin(request, "subscribers:*")` **— but is** `subscribers` **scope appropriate for tenant lifecycle and provisioning?** Existing `subscribers:write` gates business_requests writes. Tenant promotion (sandbox→partner) and provisioning approve are conceptually different — they touch tenant infrastructure, not subscriber records. Two paths:

- **(a) Reuse** `subscribers:*` — pragmatic; ships fast; `is_portal_staff` gate ensures only superadmin passes. Meaningful risk: if a future non-superadmin role gets `subscribers:*`, they'd also get tenant lifecycle powers.
- **(b) Add new scopes** `tenants:read|write` **and** `provisioning:read|write` — cleaner; requires adding scopes to the requireAdmin scope map.  
**Recommend (b)** — scope naming matters for downstream role assignment. `subscribers:write` should not implicitly grant "archive any tenant". Add the two new scopes in the same PR as the routes.

**XX5 retracted before shipping:** `sendBusinessIntakeAcknowledgment` is already wired at `business_intake.ts:64` — Batch 1's Convention #27 restore included this. Modal just POSTs to the endpoint; ack fires automatically. No action needed.

Once these four land, Batch 2 unlocks. Test target ≥237 stands.

**Two watchlist items for post-build validation:**

1. `getDemoTenantId()` **defensive check actually enforced** — if the slug-lookup returns a non-sandbox row, function must return null/error, not silently return the wrong UUID. Post-build fixture would call with a mocked db returning `tenant_type='production'` for the demo slug and assert getDemoTenantId returns null.
2. **The 13 new routes match filename↔createFileRoute discipline** — Convention #31 says file rename is the load-bearing fix. Any of the 13 with `platform-settings.demo-videos.ts` or `provisioning.$id.approve.ts` need their createFileRoute strings to match filename-derived URLs exactly. Post-build: grep for `createFileRoute` in the new files, verify strings match, verify smoke fixture catches all.  
  
**DoD**

1. `/demo-tour` renders both cards; video card honors `platform_settings.value.enabled` jsonb wrapper.
2. `BusinessIntakeModal` POSTs to existing `/api/public/v1/business_intake` with structured prefixes in `notes`.
3. `BusinessManagementPane` three tabs functional; Intake filters over stage enum, All Businesses shows lifecycle chip, Provisioning queue drives lifecycle transitions.
4. 14 new admin routes all `requireAdmin(_, "subscribers:*")`, `adminAudit` on writes.
5. DemoBanner has both CTAs functional; Exit demo signs out.
6. Landing CTAs wired (Try Sandbox → `/demo-tour`, Book a demo → modal).
7. `src/lib/demo-mode.ts` reads `tenant_type='sandbox'`; no `is_demo` reads anywhere in `src/`.
8. `rg -n "is_demo" src/` returns 0 matches (except migration comments).
9. Filename ↔ `createFileRoute` match for all 14 new routes; no duplicate segments; route-URL smoke fixture updated.
10. Tests ≥237 green.
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
