# VeloMed OS — HIS Changelog

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