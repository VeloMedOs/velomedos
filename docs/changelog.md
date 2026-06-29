# VeloMed OS — HIS Changelog

## HIS Access Entry v2

- New public deep link `/his` and role-aware launcher at `/launch`.
- Hardened `?next=` validator on `/auth` (rejects `//evil`, `/\evil`, absolute URLs) plus an authorization gate — `next` is honoured only when the resolved role can actually reach it.
- Unified HIS workspace at `/clinical` (supersedes Phase-8 "clinical tabs inside provider.tsx/admin.tsx").
- Superadmin Documentation hub: bundled HIS / Technical / RCM / Changelog manuals served from `src/lib/his-docs.ts`, surfaced under Superadmin → Documentation and at `/superadmin/docs`. Editable overlay (`his_doc` table) deferred — `PUT /api/clinical/v1/docs/{slug}` currently returns 501.
- New REST endpoints: `GET /api/clinical/v1/docs`, `GET /docs/{slug}`, `GET /docs/{slug}/{module}`.
- `requireClinicalModule` rewritten to be read-permissive / write-gated; new helpers `requireClinicalRead`, `requireClinicalWrite`, `requireModule`, and sensitive-allow-lists `READ_GATED_MODULES` / `READ_GATED_CAPS` exported from `src/lib/api-clinical.ts`.
- Marketing chrome (`SiteChrome.tsx`) adds the discreet "Staff login" link to `/his`.
- Seeded `docs/his-rcm-user-manual.md` from the role matrix.

## Phase 6 — Clinical coding + AR-DRG grouper (IMP-only)

- New tables: `clinical_coding`, `drg_assignment` (NULLABLE `drg_id`, snapshot `drg_code`+`drg_version`).
- Triggers: monotonic journey advance to `coded` / `grouped`; insert of a new `assigned` DRG supersedes prior.
- New routes (`/api/clinical/v1/encounters/:id/`): `code` (GET/POST), `group` (POST), `drg` (GET).
- Grouper integration `src/lib/mds/grouper.ts`: builds MDS from `encounter`, `encounter_hospitalization`, `encounter_diagnosis` (with POA), `charge_item.achi_code`, and `beneficiary` (age at admission, birth weight, gender). Calls `GROUPER_ENDPOINT` or returns deterministic stub.
- No grouping logic implemented — AR-DRG / ICD-10-AM / ACHI are licensed and the grouper is external CHI-approved software.
- OpenAPI: new `Coding` tag + paths.

## Phase 8 — Portal wiring (frontend)

- New endpoint: `GET /api/clinical/v1/me` returns the caller's tenant + clinical role for UI gating only — server routes remain the authorization boundary (`requireClinicalRole`).
- New helpers: `src/lib/clinical-api.ts` (typed fetch with bearer + `x-tenant-id`) and `src/lib/clinical-roles.ts` (`useClinicalMe`, `canAct`).
- New routes:
  - `/clinical` — provider Clinical Workspace (tabs: Registration · Encounters · Coding · Claims). End-to-end journey wired to existing Phase 1–7 APIs.
  - `/clinical-masters` — tenant_admin contractual masters: payers, TPAs, networks, insurance plans, services, drugs, price lists, pricing rules (tenant overrides), DRG base rates, DRG price adjustments.
  - `/clinical-superadmin` — superadmin cross-tenant read-only claims view with tenant/status filters.
- Admin overview now links to Clinical Workspace and Clinical Masters. Superadmin overview gains a "Clinical · HIS" card linking to cross-tenant claims, workspace, and tenant masters.
- Note: existing `/_authenticated/provider.tsx` (paramedic mobile cockpit) is unchanged; the HIS workspace lives at `/clinical` to keep the field UX intact.