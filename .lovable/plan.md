# Step 2 · Turn 1 — Clinical Encounter & Worklist Spine (foundation)

Acknowledging your sequencing note: the demo-flow test is landed as a side quest. Moving on to Step 2 (05+06+07). The spec is large enough that a single turn can't ship all of C1–C6 without a rewrite; the DoD §7 sequencing itself groups this into 6 buckets. This turn ships the **foundation** (bucket 3 + 4 + the substrate that unblocks bucket 5/6) and leaves EMR host, Form Builder, and module-specific worklists to explicit follow-up turns.

## Ground truth (verified against clone @ current head)

Already live — no rework needed:

- `form_def`, `clinical_form_instance`, `form_workflow_binding`, `rcm_gate_exception`, `authorization_communication`, `denial_communication`
- `v_order_item_gate` view; `charge_is_billed()`, `forms_gate_open()`, `encounter_advance_journey()` fns
- `<BilledGate>`, `<FormsGate>`, `<RcmCommCard>`, `<HimCommCard>` primitives
- API: `/api/clinical/v1/forms/{defs,instances,bindings}`, `/api/clinical/v1/gate/{view,exceptions,preview,reconcile}`
- OrdersPane joins `v_order_item_gate` (Step 1 close)

Missing that this turn ships. Missing that Turns 2–3 will ship (called out explicitly below).

## In-scope this turn

### A. Roles + nav skeleton (repo-specific gate B, DoD §22–24)

- `**src/lib/clinical-role-matrix.ts**` — append the 5 missing roles per spec §1:
  - `nutritionist, social_worker, ambulance_ems, med_records, floor_manager`
  - Add role meta (label / group / blurb / tone) and register their module capabilities:
    - `nutritionist`, `social_worker` → Clinical (assessment + care-plan forms)
    - `ambulance_ems` → Clinical + Registration & Eligibility (EMS handoff, patient bring-in)
    - `med_records` → Coding & DRG + Documentation (HIM completeness, 85-checkpoint)
    - `floor_manager` → Billing — IP/Day-Case (bed-flow) + Clinical (ADT worklist consumer)
- `**src/components/clinical/daylight/nav-config.ts**` — add a **Worklists** group and **Encounter** group entries; **class switcher** state lives in the Shell (see D). New `NavTabId`s + panes:
  - `wl-doctor` — Doctor Worklist (all classes)
  - `wl-nursing` — Nursing Workbench (all classes; explicit rename)
  - `forms-worklist` — Clinical Forms Worklist (central)
  - `rcm-comms` — RCM Communication (global thread inbox)
  - `admin-form-binding` — placeholder tab (row-level binding editor is Turn 3; the tab renders a "Turn 3" stub with the current `form_workflow_binding` rows visible read-only)
  - Module-specific worklist tabs (Ambulance/EMS, Pharmacist, Admission, Transfer/Discharge, Floor-Manager, Coder, MRD, Front-Office) are **not added** this turn — they light up in Turn 2 when their panes exist. (DoD §21 forbids "disabled: false without a real pane".)
- **Nursing Workbench rename** — grep for `Nursing Worklist` and replace to `Nursing Workbench` everywhere it appears in strings (nav labels, docs, capability descriptions, tests).

### B. Read views (repo-specific gate §23, "worklists are read views")

One additive, timestamped migration (`YYYYMMDDHHMMSS_clinical_spine_views.sql`):

- `**v_doctor_worklist**` — per-tenant per-class: `encounter` ⋈ `beneficiary` ⋈ `encounter_care_team` (physician assignee) ⋈ order-header counts ⋈ `authorization_request` (pre-auth pending) ⋈ `v_order_item_gate` (gate-state agg) ⋈ unread comm count. Columns: `tenant_id, encounter_id, class, encounter_number, beneficiary_id, mrn, name, age, token, waiting_seconds, urgency_top, ctas_level, is_vip, gate_summary (jsonb of billed/released/locked counts), pending_authorizations, unread_rcm_comms, is_walk_in, is_scheduled, journey_state`.
- `**v_nursing_workbench**` — `encounter` ⋈ `vitals_observation` (latest + due window) ⋈ `clinical_form_instance` (nurse-assigned pending) ⋈ `medication_administrations` (due window) ⋈ `care_plan_tasks`. Columns: `tenant_id, encounter_id, class, mrn, name, ward, bed, vitals_due, assessments_due, emar_due, care_tasks_open, urgency_top, rcm_status_top`.
- `**v_rcm_comm_thread**` — union of `authorization_communication` and `denial_communication`, one row per message: `tenant_id, encounter_id, order_item_ref, direction, message, status_pushed, author_role, unread, kind, created_at`. Emergency-override escalations from `rcm_gate_exception` (rows where `exception_type='emergency_override' AND closed_at IS NULL`) are added as synthetic `kind='exception_escalation'` rows in the same view.
- `**v_clinical_forms_worklist**` — `clinical_form_instance` ⋈ `form_def` ⋈ `form_workflow_binding` (latest active binding per `(form_def_id, encounter_class)`): `tenant_id, encounter_id, class, form_def_id, code, title, classification (nurse|care_team|counter|specialty), trigger_type, gate_type (pre_order|post_order|standalone), assigned_role, status, due_at, is_overdue`.

RLS-scoped by tenant via wrapped `SECURITY INVOKER` (views inherit the base-table policies; no `SECURITY DEFINER`). No new grants beyond `GRANT SELECT ... TO authenticated` on each view.

Note: `v_him_comm_thread` and its backing `him_communication` table are **Turn 2** work — `<HimCommCard>` currently reads `clinical_audit`/`clinical_coding` and stays that way this turn.

### C. New columns (spec §2.1)

Same or a paired migration (no `ALTER TYPE ... ADD VALUE` in same txn per DoD §12):

- `clinic_bookings.origin_encounter_id uuid NULL REFERENCES public.encounter(id)`
- `clinic_bookings.source text NULL` — free text this turn (`'walk_in'|'scheduled'|'er_referral'|'ip_followup'`); enum promotion is Turn 2 (separate migration first, per DoD lesson R1).
- `service_master.execution_venue text NULL` — same treatment (free text now, enum later).

### D. Panes — Doctor WL, Nursing WB, Forms WL, RCM Comms inbox

Four new panes under `src/components/clinical/daylight/worklists/`:

- `**DoctorWorklistPane.tsx**` — class-parameterized (reads `class` from URL search state, default = derived from role's home class). Renders:
  - Counters (STAT / Urgent / Waiting / Billed / Pending RCM) from `v_doctor_worklist` aggregates
  - Filter chips: RCM status × Urgency × walk-in/scheduled × IP+OP toggle (spec §4)
  - Assigned-patients table (rows with token, waiting-time color, urgency pill, gate pill, VIP chip, "Open EMR" → `?tab=encounters&enc=<id>`)
  - **Pending Orders block** (HCA-0123) — `charge_item` rows where `status='ordered'` for the current physician's assigned encounters, colored by `v_order_item_gate.gate_state`
  - **Pre-Auth Requests** rail card — `authorization_request` where `status IN ('draft','submitted','partial')`
  - Fixed **RcmCommCard** (rail) — reads `v_rcm_comm_thread` filtered to my open encounters
- `**NursingWorkbenchPane.tsx**` — vitals-due / assessment-due / eMAR-due / care-plan tasks columns from `v_nursing_workbench`; entry points route to the encounter tab's vitals / forms surfaces.
- `**ClinicalFormsWorklistPane.tsx**` — table over `v_clinical_forms_worklist` grouped by encounter/status/gate-role; role-scoped chip filter (nurse / care_team / counter / specialty); "Open form" opens the `<ClinicalForm>` host **stub** (Turn 2 will replace with the real host — this turn opens the existing `clinical_form_instance` API JSON viewer to prove wiring). Color per spec §5A.6.
- `**RcmCommsInboxPane.tsx**` — full-height thread reader over `v_rcm_comm_thread` (kind × direction × unread filters); composer posts to the existing `authorization_communication` / `denial_communication` write endpoints.

### E. Small wiring / cleanup

- `**clinical.tsx**` — mount new tabs (D) and delegate `tab === 'wl-doctor'` etc. to the panes.
- Extend `ClinicalAPI` with `listDoctorWorklist(class?)`, `listNursingWorkbench(class?)`, `listFormsWorklist(class?)`, `listRcmCommThread({encounterId?, kind?})` — thin GETs against `PostgREST` on the four views (no new server routes; views are auto-exposed).
- **Class switcher** UI in `Shell.tsx` topbar (OPD / ER / IPD / ADT / All) — writes to `?class=` search param; worklist panes read it. Role-home default per role (physician → all; ambulance_ems → EMER; floor_manager → IMP; etc.).
- **RcmCommCard** rail integration on `EncounterPane` (was already imported, not yet placed) — add the fixed sub-section per spec §3.
- Universal filter component `<WorklistFilters>` for RCM status × urgency × module-specific chips (spec §4) — used by all four panes.

### F. Non-goals for Turn 1 (explicit — Turns 2–3)

Do not attempt this turn:

- `<ClinicalForm>` host + cross-cutting behaviours (§5): DNR banner, allergy popup, copy-paste highlight, addendum-not-amend, print-empty, meaning validation, co-sign framework, MAP compute, pregnancy-mandatory, VTE icon → **Turn 2**.
- Form Builder + Workflow Binding admin center (§5A.7) — full drag/compose UI, versioning, publish → **Turn 3**.
- `him_communication` table + `v_him_comm_thread` + `<HimCommCard>` write path → **Turn 2**.
- Module-specific worklist panes: Ambulance/EMS, Pharmacist, Admission, Transfer/Discharge, Floor-Manager, Coder, MRD, Front-Office → **Turn 2** (each is a thin filter over the same views).
- Guard trigger for **forms gate on placement** (spec §5A.4 item 1) is already partially there via `forms_gate_open()`; wiring the BEFORE INSERT trigger to raise `forms_gate` in SQL → **Turn 2** (paired with the ICU-form-before-ICU-admission acceptance test).
- Class-switcher role-home defaults for the 5 new roles that don't yet have module capabilities live → coupled with their capability rows; matrix rows landed in A but landing pages are Turn 2.

## Definition of Done — Turn 1

Program-level (DoD §A):

- Traceable — every new artifact carries `HCA-0174/0175/0186/0123/0188-C` and spec §2/§3/§4/§5A refs in code comments.
- Multi-tenant — all four views scope by `tenant_id`; no cross-tenant read.
- Server authz — new capabilities registered in `clinical-role-matrix.ts` (`wl.doctor.read`, `wl.nursing.read`, `wl.forms.read`, `wl.rcm_comm.read/write`); no new server routes bypass `requireClinicalRead`.
- Additive migrations, timestamped; enum promotion deferred (source column is text this turn).
- Journey-safe — no new writes to `encounter.status`/`journey_state`; worklists are read-only.
- Standards — no new code_value writes.
- Lovable-safe — additive.

Repo-specific (DoD §B):

- Only `wl-doctor`, `wl-nursing`, `forms-worklist`, `rcm-comms` flip enabled — panes exist. Module-specific tabs stay hidden until their panes exist (Turn 2).
- New roles landed in matrix with capabilities.
- Worklists are views, not new stores.
- All new panes are tabs in `clinical.tsx`; no sibling route files.
- "Nursing Workbench" label consistent — grep for `Nursing Worklist` returns zero hits.

Feature acceptance (subset of DoD §C):

- C3 partial — Doctor WL + Nursing Workbench appear as left-nav functions for OPD/ER/IPD/ADT via class switcher; STAT/Urgent counters, Pending Orders block, Pre-Auth rail present. Module-specific worklists remain **not yet** (Turn 2).
- C4 partial — `<RcmCommCard>` fixed on Doctor WL + Encounter pane; `v_rcm_comm_thread` powers reads; emergency-override escalations surface as red items; composer writes via existing endpoints.
- C4b partial — Central Clinical Forms Worklist renders `v_clinical_forms_worklist`; role-scoped filter chips work. **Not this turn:** cards embedded inside personnel worklists (Turn 2), pre-order 403 test (Turn 2 with the trigger).
- C5 — universal filters + color standard applied uniformly across the four new panes.

Explicitly deferred (call out in the merge note):

- C4b — HIM 85-checkpoint feed, pre_order trigger on placement, post_order auto-instantiation of due tasks → Turn 2
- C4c — Form Builder / Workflow Binding admin center + HIM comms channel → Turn 3
- C6 — `<ClinicalForm>` host + cross-cutting form behaviours → Turn 2
- Module worklists (EMS/Pharmacist/Admission/Transfer/Discharge/Floor-Manager/Coder/MRD/Front-Office) → Turn 2

## Technical section

Files created:

- `supabase/migrations/<ts>_clinical_spine_views.sql` — 4 views + 2 grants + column adds (`clinic_bookings.origin_encounter_id`, `clinic_bookings.source`, `service_master.execution_venue`).
- `src/components/clinical/daylight/worklists/DoctorWorklistPane.tsx`
- `src/components/clinical/daylight/worklists/NursingWorkbenchPane.tsx`
- `src/components/clinical/daylight/worklists/ClinicalFormsWorklistPane.tsx`
- `src/components/clinical/daylight/worklists/RcmCommsInboxPane.tsx`
- `src/components/clinical/daylight/worklists/WorklistFilters.tsx`
- `src/components/clinical/daylight/ClassSwitcher.tsx`

Files edited:

- `src/lib/clinical-role-matrix.ts` — 5 new roles, `wl.*` capability ids.
- `src/components/clinical/daylight/nav-config.ts` — new `NavTabId` values + entries.
- `src/components/clinical/daylight/Shell.tsx` — class switcher chip in topbar; RcmCommCard rail placement.
- `src/routes/_authenticated/clinical.tsx` — new tab dispatches.
- `src/lib/clinical-api.ts` — 4 new list methods.
- `src/components/clinical/daylight/EncounterPane.tsx` — fixed RcmCommCard sub-section.
- Any residual `"Nursing Worklist"` string → `"Nursing Workbench"`.

Migration sketch (indicative):

```text
CREATE OR REPLACE VIEW public.v_doctor_worklist AS
SELECT e.tenant_id, e.id AS encounter_id, e.class, e.encounter_number,
       b.id AS beneficiary_id, b.mrn, b.full_name AS name,
       date_part('year', age(b.dob))::int AS age,
       nullif(e.token,'') AS token,
       EXTRACT(EPOCH FROM (now() - e.period_start))::int AS waiting_seconds,
       ...
FROM public.encounter e
JOIN public.beneficiary b ON b.id = e.beneficiary_id
LEFT JOIN LATERAL (
  SELECT count(*) FILTER (WHERE gate_state='billed') AS billed_ct,
         count(*) FILTER (WHERE gate_state='released_by_exception') AS released_ct,
         count(*) FILTER (WHERE gate_state='locked') AS locked_ct
    FROM public.v_order_item_gate g WHERE g.encounter_id = e.id
) gate ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS pending_auth_ct FROM public.authorization_request ar
   WHERE ar.encounter_id = e.id AND ar.status IN ('draft','submitted','partial')
) auth ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS unread_ct FROM public.v_rcm_comm_thread c
   WHERE c.encounter_id = e.id AND c.unread = true
) c ON true
WHERE e.status NOT IN ('cancelled','finished');
```

(Similar shape for the other three. All views: `SECURITY INVOKER`, `GRANT SELECT ... TO authenticated`.)

## Ask before I ship

One decision — how should the class switcher default per role?   
Option 1 (home-class default) with: physician → **All**, nurse → IMP, ambulance_ems → EMER, floor_manager → IMP, front_office → AMB, all other roles → All. "All" chip always one click.  
  
**Correction Addendum (append to the plan; overrides where stated)**

Plan approved with the following **seven overrides.** All schema facts below are clone-verified @3bf5e30 — do not re-derive.

## X1 — Server routes, not direct PostgREST

Every daylight pane reads via `ClinicalAPI → clinicalFetch → /api/clinical/v1/*` (zero direct supabase reads exist in `daylight/`; Step-1 precedent: `gate/view.ts`). Add four thin GET routes with cap guards:

- `worklists/doctor.ts` (cap `wl.doctor.read`), `worklists/nursing.ts` (`wl.nursing.read`), `worklists/forms.ts` (`wl.forms.read`), `worklists/rcm-comms.ts` (`wl.rcm_comm.read`). Each: `requireClinicalModule` + capId, query the view with class/filters, standard envelope. ClinicalAPI methods wrap these — no PostgREST direct reads.

## X2 — v_nursing_workbench: do NOT join tables that don't exist

`medication_administrations` and `care_plan_tasks` are greenfield (Batch C). The view ships stable columns as literals: `0::int AS emar_due, 0::int AS care_tasks_open -- TODO Batch C EMAR/care-plan stores` Do not create placeholder tables.

## X3 — Phantom columns → literals/aliases

- `encounter` has no `token` (QMS unbuilt): `NULL::text AS token -- TODO QMS batch`.
- `beneficiary` has no `is_vip`: `false AS is_vip -- TODO Patient Management`.
- MRN column is `beneficiary.patient_file_no` → `b.patient_file_no AS mrn`.
- Waiting time from `period_start` (verified) — keep.
- `encounter.status` CHECK literals verified: keep `NOT IN ('cancelled','finished')`.

## X4 — v_rcm_comm_thread real mapping + read tracking

- `authorization_communication` columns: `authorization_request_id, direction, channel, author, body, payload, created_at`. Encounter via join `authorization_request.encounter_id`. Message = `body`. `order_item_ref` = `payload->>'order_item_ref'` (nullable).
- `denial_communication` columns: `denial_case_id, direction, channel, body, attachments, actor_id, occurred_at`. Encounter via `denial_case → claim → encounter` (verify FK names on `denial_case` before writing SQL; if the chain is missing a link, expose `NULL::uuid AS encounter_id` for denial rows this turn and note it).
- **Read tracking does not exist.** Additive migration: `ALTER TABLE authorization_communication ADD COLUMN read_at timestamptz NULL, ADD COLUMN read_by uuid NULL;` same for `denial_communication`. View: `unread = (direction = <inbound literal per table> AND read_at IS NULL)`. Mark-read endpoint = Turn 2; columns land now.
- Emergency-override escalation rows: synthetic union from `rcm_gate_exception` where `exception_type='emergency_override' AND closed_at IS NULL AND reconciled_at IS NULL`, `kind='exception_escalation'`, always unread.

## X5 — Future enum naming (Turn-2 note, record now)

`booking_source` enum already exists (M03: opd/referral/follow_up/call_center/portal — Step-3 scheduling dimension). When promoting `clinic_bookings.source` (walk_in/scheduled/er_referral/ip_followup) to an enum in Turn 2, create a NEW type `visit_source`; never extend `booking_source`.

## X6 — Part-0 leftover rides along

Add one fixture to `billed-gate.test.ts`: a `scope='pbm'` TriggerHit with `preauth_required:true` folds to the exact five-field TriggerOutcome contract (`{preauth_required:true, charge_mode:null, discount:null, eligibility_check_required:false, block_reason:null}`).

## X7 — Class-switcher decision (question answered)

Option 1 (home-class default) with: physician → **All**, nurse → IMP, ambulance_ems → EMER, floor_manager → IMP, front_office → AMB, all other roles → All. "All" chip always one click.

## Added DoD

- [ ] Four `worklists/*` server routes exist with capIds; ClinicalAPI has zero direct supabase reads.
- [ ] `v_nursing_workbench` compiles with literal emar/care columns; no new tables created.
- [ ] `v_doctor_worklist` uses `patient_file_no AS mrn`, `NULL AS token`, `false AS is_vip` (grep confirms no reference to nonexistent columns).
- [ ] `read_at`/`read_by` on both comm tables; unread derived, escalations always-unread.
- [ ] PBM fold fixture green (12 tests total).
- [ ] Grep `Nursing Worklist` → 0 hits.