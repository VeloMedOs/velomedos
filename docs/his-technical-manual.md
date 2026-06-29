# VeloMed Mini-HIS — Technical Manual

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