# Turn 2b — HIM channel + 10 module worklists (v2, addendum folded in)

Builds on Turn 2a (@82fcad9). Conventions locked: reads via `ClinicalAPI → clinicalFetch → /api/clinical/v1/*` with capId; no direct supabase from panes; RLS + GRANT on every new table; cap-guarded routes; worklists are read-views only.

## Migration 1 — view recreates + classification column (no enum churn)

Recreate three views idempotently (`CREATE OR REPLACE VIEW`, SECURITY INVOKER, re-`GRANT SELECT` to authenticated):

- `**v_doctor_worklist**` — replace `false AS is_vip` residual with `COALESCE(b.is_vip, false)`; add `e.dnr_flag`, `e.isolation_precaution`, `e.journey_state`; add `discharge_disposition` from `LEFT JOIN encounter_hospitalization eh ON eh.encounter_id = e.id`; add `NULL::text AS ems_status` placeholder.
- `**v_nursing_workbench**` — add `NULL::text AS ward`, `NULL::text AS bed`.
- `**v_clinical_forms_worklist**` — add `overdue_days := GREATEST(0, EXTRACT(day FROM now() - due_at))::int`; expose `b.classification` (drop the `b.assignee_role AS classification` alias if present); expose `fd.cosign_required` via join to `form_def` so MrdPane can detect cosign backlog at column level.

`**form_workflow_binding.classification**` (W2 — backfill from `assignee_role`, not phantom form codes; `form_def` has no `category` column):

```sql
ALTER TABLE public.form_workflow_binding
  ADD COLUMN IF NOT EXISTS classification text
  CHECK (classification IN ('nurse','care_team','counter','specialty'));
UPDATE public.form_workflow_binding SET classification = CASE assignee_role
  WHEN 'nurse' THEN 'nurse'
  WHEN 'physician' THEN 'care_team'
  WHEN 'front_office' THEN 'counter'
  ELSE 'specialty' END
WHERE classification IS NULL;
```

## Migration 2 — HIM communication channel

Shape matches the RCM pattern (`authorization_communication` / `denial_communication`), **not** a bespoke shape:

```sql
CREATE TABLE public.him_communication (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  encounter_id uuid NOT NULL REFERENCES public.encounter(id),
  form_instance_id uuid NULL REFERENCES public.clinical_form_instance(id),
  coding_row_id uuid NULL REFERENCES public.clinical_coding(id),
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  channel text,
  author uuid REFERENCES auth.users(id),
  body text NOT NULL,
  payload jsonb,
  read_at timestamptz NULL,
  read_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

No `subject`, no `uuid[]` on `read_by`, no `author_role`. GRANT SELECT/INSERT/UPDATE to authenticated; ALL to service_role. RLS tenant-scoped via `is_tenant_member(auth.uid(), tenant_id)`; INSERT `WITH CHECK` sets `author = auth.uid()` and forces `direction = 'outbound'`. `updated_at` trigger via existing `touch_updated_at`.

Mark-read idempotent:

```sql
UPDATE him_communication
   SET read_at = COALESCE(read_at, now()), read_by = COALESCE(read_by, auth.uid())
 WHERE id = $1 AND read_at IS NULL;
```

`**public.v_him_comm_thread**` (SECURITY INVOKER) — joins `him_communication` + `profiles` (author name) + computes `is_read_by_me := read_at IS NOT NULL AND read_by = auth.uid()`. GRANT SELECT to authenticated.

## Capabilities (`src/lib/clinical-role-matrix.ts`)

- `wl.him_comm.read` → coder, med_records, physician, nurse, tenant_admin
- `wl.him_comm.write` → coder, med_records, physician, nurse, tenant_admin
- Per-worklist caps for the 10 new panes (see W1 list).

## Server routes

**HIM (3):**

- `GET /api/clinical/v1/worklists/him-comms.ts?encounterId=` — cap `wl.him_comm.read`, reads `v_him_comm_thread`
- `POST /api/clinical/v1/him-communications.ts` — cap `wl.him_comm.write`, Zod-validated insert
- `PATCH /api/clinical/v1/him-communications/$id/read.ts` — cap `wl.him_comm.read`, idempotent mark-read

**10 module worklist routes** under `src/routes/api/clinical/v1/worklists/`, all cap-guarded, all thin filters over `v_doctor_worklist`, `v_nursing_workbench`, `v_clinical_forms_worklist`, `**v_rcm_comm_thread**` (correct name — W4), plus `v_order_item_gate` for locked rows:


| Tab id                  | Cap                     | Roles                                         |
| ----------------------- | ----------------------- | --------------------------------------------- |
| `wl-ems`                | `wl.ems.read`           | ambulance_ems, physician, nurse               |
| `wl-front-office`       | `wl.front_office.read`  | front_office, tenant_admin                    |
| `wl-admission`          | `wl.admission.read`     | nurse, physician, floor_manager, tenant_admin |
| `wl-floor-manager`      | `wl.floor_manager.read` | floor_manager                                 |
| `wl-transfer-discharge` | `wl.discharge.read`     | physician, nurse, case_manager, floor_manager |
| `wl-coder`              | `wl.coder.read`         | coder, med_records                            |
| `wl-mrd`                | `wl.mrd.read`           | med_records, coder                            |
| `wl-pharmacist`         | `wl.pharmacist.read`    | pharmacist, physician                         |
| `wl-nutrition`          | `wl.nutrition.read`     | nutritionist, physician, nurse                |
| `wl-social-work`        | `wl.social_work.read`   | social_worker, physician, case_manager        |


**Not shipping:** extended Physician/Nursing/Billing/RCM (Turn 1), Lab/Radiology (Batch C scope), Coder-as-extension (own pane above).

Missing roles (`nutritionist`, `social_worker`, `ambulance_ems`, `med_records`, `floor_manager`) added to `clinical-role-matrix.ts` if not already present.

**Filter specifics:**

- **CoderPane** — `encounter.status = 'finished' AND journey_state = 'discharged'` (W8).
- **MrdPane** — `is_overdue = true OR (status = 'submitted' AND cosign_required = true AND cosigned_at IS NULL)` (W9). Reads `cosign_required` from the extended `v_clinical_forms_worklist`.

## Client

`**clinical-api.ts**` — extend `worklistsApi` with `himComms(encounterId)`, `postHimComm(payload)`, `markHimCommRead(id)`, and one method per new worklist route.

`**HimCommCard.tsx**` — rewrite: read `v_him_comm_thread` via `worklistsApi.himComms`; compose via `postHimComm`; mark unread on view. No reads from `clinical_audit` / `clinical_coding`. Deep-link row actions: `form_instance_id` → `?tab=forms-worklist&instance=<id>`; `coding_row_id` → `?tab=coding&row=<id>`.

**Embed HimCommCard on rails of:** `DoctorWorklistPane`, `NursingWorkbenchPane`, `ClinicalFormsWorklistPane` (W6). **Not** EncounterPane / CodingPane / ClaimsWorklistPane — those are RCM surfaces and keep RcmCommCard.

`**FormsMiniCard**` — new standalone component:

```
props: { encounterId: string; classification: 'nurse'|'care_team'|'counter'|'specialty'; maxRows?: number }
```

Reads `v_clinical_forms_worklist` filtered by `classification` + `encounterId`. Renders count + open forms list; click opens the ClinicalForm host.

**Pane → classification mapping (W7):**

- Nursing Workbench, Admission, Transfer/Discharge, Floor-Manager → `nurse`
- Doctor WL, Pharmacist, EMS → `care_team`
- Front Office → `counter`
- Nutrition, Social-work → `specialty`
- Coder, MRD → no FormsMiniCard (they use the full Forms WL)

**10 panes** under `src/components/clinical/daylight/worklists/` copying the `DoctorWorklistPane` shape, using `WorklistFilters` + `ClassSwitcher`, embedding `FormsMiniCard` per mapping. No direct `.from(...)` — reads only via the four views + `v_order_item_gate`.

Add `wl-ems`, `wl-front-office`, `wl-admission`, `wl-floor-manager`, `wl-transfer-discharge`, `wl-coder`, `wl-mrd`, `wl-pharmacist`, `wl-nutrition`, `wl-social-work` to `NavTabId`, `NAV_SECTIONS` (Worklists group), and the tab switch in `clinical.tsx`.

## Tests

- Per-pane filter fixtures (≥1 per module, ≥3 assertions each) → ≥32 green.
- Deep-link resolution for each new `tab=wl-*`.
- HIM round-trip: post → list → mark-read → `is_read_by_me = true`; second mark-read is a no-op (idempotency).
- Grep asserts: `false AS is_vip` = 0 hits; `v_rcm_comms_inbox` = 0 hits; `HimCommCard` does not import `clinical_audit`.
- Deep-link from HimCommCard row (form_instance_id / coding_row_id) resolves to expected `?tab=...` search params.

## DoD

- Part-0 view residual fixed (`false AS is_vip` grep = 0)
- `form_workflow_binding.classification` has CHECK on the four values; backfill row count > 0
- `him_communication` shape matches RCM pattern (no `subject`, `read_by` scalar uuid, has `direction`/`channel`/`payload`/`form_instance_id`/`coding_row_id`)
- `v_him_comm_thread` + `v_rcm_comm_thread` referenced correctly (0 hits for `v_rcm_comms_inbox`)
- 3 HIM routes cap-guarded; RLS + GRANTs in place
- `HimCommCard` reads only `v_him_comm_thread`; embedded on Doctor / Nursing / Forms-WL panes only
- `FormsMiniCard` typed to the 4 classification values; classification-filtered reads
- Exactly the 10 panes above land — grep in `daylight/worklists/` matches list
- CoderPane filter uses `status='finished' AND journey_state='discharged'`
- MrdPane cosign filter uses column-level `cosign_required=true AND cosigned_at IS NULL`
- `wl-nutrition` + `wl-social-work` present in nav + routes + tab switch
- Tests ≥32 green
- **Remove the "expose cosign_required via join to form_def" clause** from the v_clinical_forms_worklist recreate (`cosign_required` already lives on `form_workflow_binding` and is already exposed via `b.cosign_required` at line 151). Zero work — just delete that sentence so Lovable doesn't try to add a form_def column that isn't needed.
- **HimCommCard "mark unread on view" needs bounding.** As written, opening the card marks every unread row as read on mount — that will race with the composer (post a new comm → immediately marked read by the poster in the same second), and produces bad audit optics. Bound it: only mark rows read where `direction = 'inbound'` AND `author != auth.uid()`. Same pattern the eventual RCM parity fix will need.  
  
Plan approved. Two amendments: (a) remove the "expose cosign_required via join to form_def" clause from v_clinical_forms_worklist — the column already lives on form_workflow_binding and is already exposed as b.cosign_required, so no view change needed for MrdPane's filter; (b) HimCommCard mark-read on view must filter to direction='inbound' AND author != auth.uid() to avoid the poster auto-marking their own outbound message as read. Proceed with build.