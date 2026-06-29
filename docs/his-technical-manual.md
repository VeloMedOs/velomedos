# VeloMed Mini-HIS — Technical Manual

## Access entry architecture (v2)

- **Single door:** every human signs in through `/auth`. Search-param `next` is validated by `z.string().regex(/^\/(?![\/\\])/)`, which rejects absolute URLs, protocol-relative `//evil` and backslash `/\evil` bait. `next` is *honoured only when authorised* — both `auth.tsx` and the launcher resolve the user's allow-set via `resolveDestination()` in `src/lib/launch-destination.ts` and drop unauthorised targets silently.
- **Launcher (`/launch`):** `src/routes/_authenticated/launch.tsx`. Loads platform roles from `user_roles` and the active tenant's `clinical_role` from `tenant_members` in parallel. Single-destination → auto-redirect; multi-destination → card launcher. Multi-tenant users see a picker; choice persists in `localStorage('velomed.active_tenant')` and is mirrored to the `x-tenant-id` header for downstream clinical calls.
- **Deep link (`/his`):** public route. Authed → `/launch`; unauthed → `/auth?next=/launch`. Surfaced from `SiteChrome` as the discreet "Staff login" link.
- **Unified `/clinical` workspace:** supersedes the Phase-8 "clinical tabs inside provider.tsx/admin.tsx". The HIS workspace shell at `src/routes/_authenticated/clinical.tsx` filters its left rail with `modulesForRole(role)`; `read_only` gets every module (view-only badge). `provider.tsx` and `admin.tsx` keep their non-HIS surfaces and link out.

## Documentation hub

- **Read path:** bundled. `src/lib/his-docs.ts` is the *single* module that does the Vite `?raw` imports for `docs/*.md`. The Superadmin Docs UI and the API both read from this manifest — no deep relative `?raw` imports inside `src/routes/api/clinical/v1/docs/*`.
- **API:** `GET /api/clinical/v1/docs` (manifest), `GET /api/clinical/v1/docs/{slug}` (full markdown), `GET /api/clinical/v1/docs/{slug}/{module}` (slice by `## <module>` heading). `PUT /api/clinical/v1/docs/{slug}` is guarded by `requireClinicalModule(req, "Documentation", { capId: "docs.write" })` and currently returns 501 — the DB-overlay write path (`his_doc` table) is on the roadmap.
- **UI:** `src/components/superadmin/DocsPane.tsx` (embedded in Superadmin → Documentation tab, also reachable at `/superadmin/docs`). Uses `react-markdown` + `remark-gfm`, builds a sticky TOC from `##` / `###` headings, supports section filter and `.md` download.

## Per-module API guards

`src/lib/api-clinical.ts` is the SSOT for HIS/RCM authorization. The model is **read-permissive, write-gated**:

- `requireTenant(request)` — any authenticated tenant member; `tenant_admin` is implicitly allowed everywhere downstream.
- `requireClinicalRead(request, module)` — GETs only; throws in dev if called on a write method.
- `requireClinicalWrite(request, module, { capId? })` — writes; requires an action capability in the module (or specifically `capId` when supplied). `read_only` is rejected.
- `requireClinicalModule(request, module, { capId? })` (also exported as `requireModule`) — dispatches read vs write by HTTP method.
- **Sensitive overrides:** `READ_GATED_MODULES = { "Cash & ZATCA" }` and `READ_GATED_CAPS = { "claim.post", "dep.approve" }` — these require the capability even for GET.

Existing routes that use `requireClinicalRole(roles)` continue to work; new routes should prefer `requireModule(request, module)` to stay matrix-driven.

## DB alignment

`clinical_role` enum holds all 17 values from `ClinicalRole` (verified via `enum_range`). No migration required for this release.

## Phase 6 — Coding + AR-DRG Grouper

### Data model

- **`clinical_coding`** — one row per encounter (`UNIQUE encounter_id`). Fields: `coder_id`, `status (in_progress|coded|amended)`, `principal_diagnosis_id` → `encounter_diagnosis`, `coded_at`, `notes`. Trigger: when `status='coded'` → `encounter_advance_journey(encounter_id,'coded')`.
- **`drg_assignment`** — historical, one `assigned` per encounter (partial unique index). Fields: `drg_id` (NULLABLE FK → `drg`), `drg_code` + `drg_version` (snapshot, always required), `mdc`, `adrg`, `partition`, `complexity_score`, `grouper_name`, `grouper_version`, `grouper_request` (jsonb), `grouper_response` (jsonb), `assigned_at`, `status (assigned|superseded)`. Triggers: BEFORE INSERT supersedes any prior `assigned` for the same encounter; AFTER INSERT advances journey to `grouped`.

### Grouper MDS input contract (`buildGrouperMds`)

| Field | Source |
|---|---|
| principal_diagnosis (ICD-10-AM) + POA | `encounter_diagnosis` where `role='principal'` |
| additional_diagnoses[] + POA | remaining `encounter_diagnosis` rows |
| procedures (ACHI) | `charge_item.achi_code` (distinct) for the encounter |
| age_years / age_days | computed at `encounter_hospitalization.admitted_at − beneficiary.dob` |
| sex | `beneficiary.gender` |
| los_days | `encounter_hospitalization.length_of_stay_days` |
| same_day, mechanical_ventilation_hours, separation_mode | `encounter` |
| birth_weight_grams | `beneficiary.birth_weight_grams` |

### External grouper

- Env: `GROUPER_ENDPOINT`, `GROUPER_API_KEY` (read at call time inside `callGrouper`).
- Request: `POST { …GrouperMds }` with `Authorization: Bearer …` when key set.
- Response (normalised): `{ drg_code, drg_version, mdc, adrg, partition, complexity_score, grouper_name, grouper_version }`.
- When `GROUPER_ENDPOINT` is unset, a deterministic stub returns `F62B / AR-DRG v9.0 / MDC 05`.
- **No grouping logic is implemented in-house** (licensed). We only assemble inputs and store the returned DRG.

### `drg_id` binding

After grouper response, we best-effort lookup `drg` by `(drg_code, version)`. If unmatched (e.g. reference catalogue not loaded), we still INSERT with `drg_id = NULL`. The `drg_code` + `drg_version` snapshot is the source of truth for downstream pricing.

### Routes

- `GET /api/clinical/v1/encounters/:id/code` — current coding row.
- `POST /api/clinical/v1/encounters/:id/code` — finalize; requires class=IMP, journey ≥ `discharged`, encounter has principal Dx, `principal_diagnosis_id` matches.
- `POST /api/clinical/v1/encounters/:id/group` — run grouper; requires class=IMP, journey ≥ `coded`. Idempotent unless `{ force: true }`.
- `GET /api/clinical/v1/encounters/:id/drg` — current assignment + history.
## Phase 8 — Portal architecture

### Surfaces
- `/clinical` (`src/routes/_authenticated/clinical.tsx`) — provider HIS workspace.
- `/clinical-masters` (`src/routes/_authenticated/clinical-masters.tsx`) — tenant_admin masters CRUD.
- `/clinical-superadmin` (`src/routes/_authenticated/clinical-superadmin.tsx`) — superadmin cross-tenant claims (direct Supabase read; gated by `user_roles.role = 'superadmin'`).

### Shared
- `src/lib/clinical-api.ts` — `clinicalFetch<T>` + `ClinicalAPI.*` typed wrappers. Injects Supabase bearer; supports `x-tenant-id` header. Throws `ClinicalApiError(message, status, code, payload)` on non-2xx.
- `src/lib/clinical-roles.ts` — `useClinicalMe()` reads `GET /api/clinical/v1/me`; `canAct(me, allowed)` returns true for the requested clinical roles or `tenant_admin`.

### Security boundary (do not misread)
UI role-gating in `clinical.tsx` and disabled buttons in `clinical-masters.tsx` are **UX only**. The authorization boundary is the server: every `/api/clinical/v1/*` route uses `requireClinicalRole` or `requireTenant`. A hidden action still 403s if invoked directly.

### New endpoint
- `GET /api/clinical/v1/me` → `{ data: { user_id, tenant_id, role, clinical_role } }`. Requires bearer; otherwise standard envelope.
