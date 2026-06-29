# VeloMed OS — HIS Changelog

## Phase 6 — Clinical coding + AR-DRG grouper (IMP-only)

- New tables: `clinical_coding`, `drg_assignment` (NULLABLE `drg_id`, snapshot `drg_code`+`drg_version`).
- Triggers: monotonic journey advance to `coded` / `grouped`; insert of a new `assigned` DRG supersedes prior.
- New routes (`/api/clinical/v1/encounters/:id/`): `code` (GET/POST), `group` (POST), `drg` (GET).
- Grouper integration `src/lib/mds/grouper.ts`: builds MDS from `encounter`, `encounter_hospitalization`, `encounter_diagnosis` (with POA), `charge_item.achi_code`, and `beneficiary` (age at admission, birth weight, gender). Calls `GROUPER_ENDPOINT` or returns deterministic stub.
- No grouping logic implemented — AR-DRG / ICD-10-AM / ACHI are licensed and the grouper is external CHI-approved software.
- OpenAPI: new `Coding` tag + paths.