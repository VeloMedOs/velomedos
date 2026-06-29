# VeloMed — HIS Access Entry v2 (final, corrected)

One door (`/auth`), a role-aware launcher at `/launch`, a Superadmin documentation hub (bundled read + DB-versioned overlay), a unified `/clinical` workspace, and per-module write-gated/read-permissive API guards driven by `src/lib/clinical-role-matrix.ts`. Folds in the three corrections from review (tagged **[FIX]**).

## 1. Single entry + safe `?next=` propagation

- `src/routes/auth.tsx` — `validateSearch` adds `next: z.string().regex(/^\/(?![\/\\])/).optional()` (rejects empty, absolute `http://…`, protocol-relative `//evil`, backslash `/\evil`). After sign-in: (1) if `search.next` is set AND the resolved role is authorized for that area (§2 gate) → go there; (2) else → `/launch`.
- `src/routes/_authenticated/route.tsx` — keep `?next=<pathname+search>`; re-verify it passes the tightened validator (pathname starts with a single `/`, so it does).
- `src/routes/his.tsx` [NEW, public] — authed → `redirect({ to:'/launch' })`; else `redirect({ to:'/auth', search:{ next:'/launch' } })`.
- `SiteChrome.tsx` — discreet "Staff / Provider Login" → `/his`, distinct from patient "Sign in".

## 2. Role-aware launcher at `/launch`

- `src/routes/_authenticated/launch.tsx` [NEW] → `/launch`. (Do NOT add `_authenticated/index.tsx` — `index.tsx` is the marketing landing at `/`.)
- Loader (parallel, `requireSupabaseAuth`-backed): platform roles from `user_roles` (`AppRole[]`); active tenant + `clinical_role` from `tenant_members` (§2a).
- Allow-set of destinations: superadmin→`/superadmin`; any `clinical_role`→`/clinical`; business_admin→`/business`; call_center→`/call-center`; dispatcher→`/dispatch`; fleet→`/fleet`; provider→`/provider`; patient-only→`/patient`.
- **next authorization gate**: if `?next=` ∈ allow-set → go; else drop and use role default. Single-destination → auto-redirect; multi → card launcher.

### 2a. Active-tenant resolution (multi-tenant)

0 members → error card + sign-out; 1 → use it; 2+ → honor persisted choice (`localStorage('velomed.active_tenant')` + SSR cookie mirror) if still valid, else tenant picker. Downstream clinical server fns read active tenant from `x-tenant-id` (already in `requireTenant`).

## 3. Unified `/clinical` workspace (supersedes Phase-8 clinical-in-provider/admin tabs)

`src/routes/_authenticated/clinical.tsx` becomes the HIS shell: left rail filtered by `modulesForRole(clinicalRole)`; `read_only` sees every module (view-only badge). Move clinical content out of `provider.tsx`/`admin.tsx` tabs into here; those pages keep non-HIS surfaces and link to `/clinical`. Document the supersession in `changelog.md` + technical manual.

## 4. HIS Privileges matrix tab

`HisPrivilegesPane` renders `CLINICAL_ROLE_META × clinicalCapabilitiesByModule()` with the platform grid layout. `read_only` column rendered from `modulesForRole('read_only')` (full breadth, view-only treatment) so it isn't empty.

## 5. Per-module API guards — write-gated, read-permissive

Two-tier model in `src/lib/api-clinical.ts`:

- `requireClinicalRead(request, module)`: authenticated tenant member; GET/HEAD/OPTIONS pass for any clinical role (RLS scopes per-tenant). **[FIX] Non-GET →** `throw` **(assertion/500), not 405** — the read helper should never receive a write; a 405 would silently mask a routing mistake. `requireModule` guarantees correct dispatch, so reaching here on non-GET is a developer error and should surface.
- `requireClinicalWrite(request, module, { capId? })`: requires action capability in `module` (or the specific `capId`); `read_only` → 403 always; `tenant_admin` always allowed.
- `requireModule(request, module, { capId? })`: dispatches read vs write by HTTP method.
- **[FIX] Sensitive access uses real names + capId, not pseudo-paths.** Read-gate by **module**: `READ_GATED_MODULES = ['Cash & ZATCA']` (GET there requires a capability). Read-gate sensitive **sub-actions** by **capId**: `READ_GATED_CAPS = ['claim.post', 'dep.approve']` — their GET requires the cap. (The earlier `'Claims & Remittance > posting'` strings never matched a real module and are removed.)

Wire `requireModule` into every `src/routes/api/clinical/v1/**` route per the matrix. OpenAPI: tag each route with its `module`; `superadmin.api-docs.tsx` groups by tag.

## 6. DB alignment

No-op migration only if `clinical_role` is missing any of the 17 `ClinicalRole` values (prior migration added 5); confirm with a quick `read_query` before shipping.

## 7. Documentation hub — bundled read, DB-versioned write

Workers runtime has no repo `fs` at request time. Split read/write:

- **[FIX] Read path centralized.** Create `src/lib/his-docs.ts` as the **single** module doing the Vite `?raw` imports, exporting a typed manifest (`{ slug, title, body }[]`). Do NOT scatter deep relative `?raw` imports inside `src/routes/api/clinical/v1/docs/*` (repo-root `docs/` is six levels up from there — `'../../../docs/…'` won't resolve). Everything imports from `@/lib/his-docs`. **Confirm Vite** `server.fs.allow` **permits reading repo-root** `docs/`; if it's locked to `src/`, add `docs/` to the allow-list or keep the bundled copies under `src/content/manuals/`.
- **Write/overlay path**: table `his_doc` (`slug, version, title, body_md, updated_by, updated_at, published`), RLS write only for `tenant_admin`/superadmin. Serve published overlay if present, else the bundled default.
- **API** `src/routes/api/clinical/v1/docs/*`: `GET /docs` (manifest: slug/title/source/version), `GET /docs/{slug}`, `GET /docs/{slug}/{moduleAnchor}` (slice by `## <anchor>`), `PUT /docs/{slug}` (guarded by `requireClinicalWrite('Documentation', { capId:'docs.write' })`).
- **UI** `src/routes/_authenticated/superadmin.docs.tsx` [NEW] — tabs HIS User · HIS Technical · RCM User · Changelog; `react-markdown` + remark-gfm, TOC, client-side search, per-module anchors, md download, inline edit (textarea+preview) for `docs.write`. PDF deferred.
- Seed `docs/his-rcm-user-manual.md`; add "Documentation" to Superadmin `SideNav`.

## 8. Docs (DoD)

`his-user-manual.md` ("Access the HIS"), `his-technical-manual.md` (entry/launcher/redirect, `next` validator + authorization gate, unified `/clinical` supersession, docs read/write model, `requireModule` as SSOT), `his-rcm-user-manual.md` [NEW stub], `changelog.md` entry.

## Acceptance

- `/his` unauth → `/auth?next=/launch` → lands `/launch`; physician → `/clinical` with `modulesForRole('physician')`; RCM → RCM modules; superadmin → `/superadmin`; multi → cards.
- Patient with `?next=/superadmin` → next dropped → `/patient`. `next=//evil.com` / `/\evil` → rejected.
- Superadmin → Documentation reads/searches; `tenant_admin` edits via overlay; others read-only.
- `/privileges` shows HIS matrix with `read_only` populated as view-only.
- `cashier`: POST Authorization=403, GET Authorization=200, POST Billing=200.
- Calling `requireClinicalRead` with a non-GET throws in dev (not silent 405). Multi-tenant user sees the tenant picker first. Single session throughout.

## File changes

```
NEW   src/routes/his.tsx · src/routes/_authenticated/launch.tsx
NEW   src/routes/_authenticated/superadmin.docs.tsx
NEW   src/lib/his-docs.ts                       (centralized ?raw manifest)   [FIX]
NEW   src/routes/api/clinical/v1/docs/{index,$slug,$slug.$module}.ts
NEW   docs/his-rcm-user-manual.md
EDIT  src/routes/auth.tsx · _authenticated/route.tsx · _authenticated/clinical.tsx
EDIT  src/routes/_authenticated/privileges.tsx · components/superadmin/HisPrivilegesPane.tsx
EDIT  src/components/superadmin/SideNav.tsx · src/components/SiteChrome.tsx
EDIT  src/lib/api-clinical.ts                   (read/write/module guards; READ_GATED_MODULES+CAPS) [FIX]
EDIT  src/routes/api/clinical/v1/**             (swap to requireModule)
EDIT  src/lib/openapi-clinical-spec.ts · src/routes/_authenticated/superadmin.api-docs.tsx
MIG?  clinical_role enum (only if values missing)
NEW?  his_doc table + RLS (if shipping overlay editor this pass)
EDIT  docs/his-user-manual.md · his-technical-manual.md · changelog.md

```

&nbsp;