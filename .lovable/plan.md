# Step 2 · Turn 2 — Clinical Spine (behaviors + module worklists + forms gate)

## Sequencing recommendation

**Split into Turn 2a + Turn 2b.** Ship 2a first.

Rationale:

- Scope in one turn is ~14 new files (ClinicalForm host + subcomponents, forms-gate trigger migration, HIM table + view migration, 8 module panes, 8+ new routes, visit_source enum migration pair, 4 test fixtures). One-shot risks partial delivery and undermines the "verify behavior, not existence" DoD lesson from Turn 1.
- 2a's correctness surface (forms gate, meaning validation, addendum-not-amend, co-sign lock) is the hardest and gates Turn 3's Form Builder — Form Builder edits the definitions 2a's host renders.
- 2b is pattern-copy over 2a's substrate: HIM channel mirrors RCM channel (already shipped), eight module worklists are thin filters over Turn-1 views. Low risk, high volume — ideal second turn.
- Your own note agrees; I'm confirming.

**This plan covers Turn 2a only.** Turn 2b will be planned separately after 2a lands and is verified.

## Turn 2a scope — A + B + E

### A. `<ClinicalForm>` host + cross-cutting behaviors (Dev Spec §5, DoD C6)

New files under `src/components/clinical/daylight/forms/`:

- `ClinicalForm.tsx` — host. Reads `clinical_form_instance` + `form_def` via `ClinicalAPI.getFormInstance(id)`. Renders fields per `form_def.schema` (JSON Schema shape already in Turn-1 view). Handles submit / addendum / print / co-sign flows.
- `AlertingPopup.tsx` — chart-open modal listing allergies, DNR, isolation, VIP, pregnancy risk. Pulls from `beneficiary` + `patient_allergies` + `patient_conditions` via a new `GET /api/clinical/v1/encounters/$id/alerts` route (cap `enc.alerts.read`). Deep-linked from `EncounterPane` mount.
- `DnrBanner.tsx` — full-width red banner, mounted in `EncounterPane` above the tab strip. All roles see it. Reads `beneficiary.dnr_flag` (add column in migration below).
- `IsolationChip.tsx` — non-Standard precaution chip; reads `beneficiary.isolation_precaution` (nullable text, free now, enum later).
- `PasteHighlightField.tsx` — controlled input/textarea wrapper. On `paste` event, wraps pasted range in a span with `bg-yellow-100`. Persists highlight ranges in `clinical_form_instance.paste_ranges jsonb`.
- `AddendumEditor.tsx` — after `status='cosigned'` (or `submitted` with no cosign required), edits are forbidden. Instead, "Add Addendum" opens an appended block; original text renders with `<s>`; both blocks carry author + timestamp; addendum rows stored as `clinical_form_instance.addenda jsonb[]`.
- `PrintEmptyForm.tsx` — renders the schema with placeholders (`___`) for unfilled mandatory fields. Uses `window.print()` on a print-only stylesheet.
- `MapField.tsx` — MAP = (2*DBP + SBP) / 3, computed only when both present. Rejects lone value with inline error.
- `FallRiskField.tsx` — accepts Morse OR Hendrich OR custom instrument code from `code_system` (fall-risk scale family). Never Morse-only-hardcoded.
- `VteIcon.tsx` — small icon rendered when `encounter_diagnosis` carries a VTE risk flag (via `code_value.system='vte-risk'`).
- `PregnancyMandatoryField.tsx` — active when `beneficiary.gender='female'` AND age ∈ [15, 55]. Required on rad order forms; blocks submit if empty.

Behaviors wired at the host level (not per-field):

- Copy-paste highlight: attach paste listener globally within `<ClinicalForm>`.
- Meaning validation: on submit, walk mandatory string fields; reject values that match `/^[.\s]{1,2}$/` or `/^[^\p{L}\p{N}]+$/u` with `422 MEANING_INVALID { field }`.
- Co-sign framework: `form_def.cosign_required` boolean → after submit, `status='pending_cosign'`. GP submits → MRP receives cosign queue entry (`v_clinical_forms_worklist` filtered by `cosign_pending_for = auth.uid()`). Post-cosign edits go through AddendumEditor only.
- Resident discharge summary: reuse cosign framework; no special-case code path.

### B. Forms-gate placement trigger + `post_order` auto-instantiation (DoD C4b)

**Migration 1 (own file):** BEFORE INSERT trigger on `lab_order_item`, `radiology_order_item`, `ep_order_item`, `service_order_item`, `prescription_item`.

```sql
CREATE OR REPLACE FUNCTION public.enforce_forms_gate_on_order_item()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _enc_id uuid; _service_id uuid;
BEGIN
  -- Derive encounter_id from parent order header (per table)
  -- Call forms_gate_open(_enc_id, TG_TABLE_NAME, NULL) — pre-placement check
  IF NOT public.forms_gate_open(_enc_id, TG_TABLE_NAME, NULL) THEN
    RAISE EXCEPTION 'forms_gate: mandatory pre-order forms not submitted'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
```

Attached to all 5 tables. Trigger name: `<table>_forms_gate_before_insert`.

**API layer:** extend `_order-factory.ts` POST path to call `forms_gate_open` (via existing view or a new `/api/clinical/v1/gate/forms-preview` route) BEFORE the DB write, returning `403 forms_gate` with `missing_forms: string[]`. Same shape as billed-gate. Defense in depth — trigger is the enforcer, API returns cleanly.

**Migration 2 (paired):** AFTER INSERT trigger on the same 5 tables that spawns `clinical_form_instance` rows per matching `form_workflow_binding` where `trigger_type='post_order'`:

```sql
CREATE OR REPLACE FUNCTION public.instantiate_post_order_forms()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.clinical_form_instance (tenant_id, encounter_id, form_def_id, order_item_table, order_item_id, status, due_at, ...)
  SELECT b.tenant_id, _enc_id, b.form_def_id, TG_TABLE_NAME, NEW.id, 'pending',
         now() + make_interval(mins => COALESCE(b.due_window_minutes, 60)), ...
    FROM public.form_workflow_binding b
   WHERE b.active AND b.trigger_type = 'post_order'
     AND (b.encounter_class IS NULL OR b.encounter_class = _enc_class)
     AND (b.order_item_table IS NULL OR b.order_item_table = TG_TABLE_NAME)
     AND (b.service_id IS NULL OR b.service_id = NEW.service_id);
  RETURN NEW;
END $$;
```

**ICU acceptance test (seed as data, not code):**

- Insert one `form_def` row: `code='ICU_ADMISSION_CHECKLIST'`, mandatory fields per §5A.
- Insert one `form_workflow_binding` row: `form_def_id=<above>`, `gate_type='pre_order'`, `trigger_type='pre'`, `encounter_class='IMP'`, `service_id=<ICU admission service_master row>`, `mandatory=true`.
- Test: POST service order-item with that service_id on an IMP encounter without submitting the form → 403 `forms_gate`. Submit the form → POST succeeds.
- **Grep guard in DoD:** `rg -i 'ICU.*form|icu_admission_checklist' src/` returns zero code hits — the binding is data-only.

### E. `visit_source` enum promotion (Turn-1 X5)

**Migration 3 (own file, must land before Migration 4):**

```sql
CREATE TYPE public.visit_source AS ENUM ('walk_in','scheduled','er_referral','ip_followup');
```

**Migration 4 (paired):**

```sql
ALTER TABLE public.clinic_bookings
  ALTER COLUMN source TYPE public.visit_source USING source::public.visit_source;
```

`booking_source` (M03) untouched. Grep `booking_source` post-migration confirms unchanged.

### Tests (added to existing suites)

New file `src/lib/clinical/forms-gate.test.ts` (or extend `billed-gate.test.ts` if same fixture harness):

1. `forms_gate` fixture — ICU order-item without form → error; with form → pass.
2. `post_order` fixture — successful order INSERT spawns `clinical_form_instance` rows.
3. Meaning-validation fixture — submit `"."` in mandatory field → `MEANING_INVALID`.
4. MAP compute fixture — lone SBP → validation error; both present → computed value.

Full suite ≥ 16 green (Turn-1 was 12; +4 = 16).

## Files created (Turn 2a)

- `src/components/clinical/daylight/forms/ClinicalForm.tsx`
- `src/components/clinical/daylight/forms/AlertingPopup.tsx`
- `src/components/clinical/daylight/forms/DnrBanner.tsx`
- `src/components/clinical/daylight/forms/IsolationChip.tsx`
- `src/components/clinical/daylight/forms/PasteHighlightField.tsx`
- `src/components/clinical/daylight/forms/AddendumEditor.tsx`
- `src/components/clinical/daylight/forms/PrintEmptyForm.tsx`
- `src/components/clinical/daylight/forms/MapField.tsx`
- `src/components/clinical/daylight/forms/FallRiskField.tsx`
- `src/components/clinical/daylight/forms/VteIcon.tsx`
- `src/components/clinical/daylight/forms/PregnancyMandatoryField.tsx`
- `src/routes/api/clinical/v1/encounters.$id.alerts.ts`
- `src/routes/api/clinical/v1/gate/forms-preview.ts`
- `supabase/migrations/<ts1>_forms_gate_trigger.sql`
- `supabase/migrations/<ts2>_post_order_instantiation.sql`
- `supabase/migrations/<ts3>_visit_source_enum.sql`
- `supabase/migrations/<ts4>_clinic_bookings_source_promote.sql`
- `supabase/migrations/<ts0>_clinical_form_instance_addenda.sql` — adds `paste_ranges jsonb`, `addenda jsonb[]`, `cosign_required boolean`, `cosign_pending_for uuid`, `cosigned_at timestamptz`, `cosigned_by uuid` to `clinical_form_instance`; adds `dnr_flag boolean DEFAULT false`, `isolation_precaution text` to `beneficiary`.
- `src/lib/clinical/forms-gate.test.ts` (or extension to `billed-gate.test.ts`)
- Seed migration for ICU form_def + form_workflow_binding row (own file, additive)

## Files edited

- `src/lib/clinical-api.ts` — add `getFormInstance`, `submitFormInstance`, `addFormAddendum`, `cosignFormInstance`, `getEncounterAlerts`, `previewFormsGate`.
- `src/routes/api/clinical/v1/_order-factory.ts` — pre-flight `forms_gate_open` check; return `403 forms_gate` with `missing_forms`.
- `src/components/clinical/daylight/EncounterPane.tsx` — mount `<AlertingPopup>` on encounter open; mount `<DnrBanner>` above tab strip.
- `src/components/clinical/daylight/OrdersPane.tsx` — surface `forms_gate` 403 the same way as `billed_gate`.
- `src/integrations/supabase/types.ts` — regenerated post-migration.

## Definition of Done (Turn 2a subset)

- All 4 migrations land in order; enum migration precedes ALTER TABLE.
- DNR banner renders on chart open when `beneficiary.dnr_flag=true`; visible to all roles.
- Alerting popup fires once per encounter open (session-scoped dismissal).
- Copy-paste highlight: paste event wraps range in yellow span; persists in `paste_ranges`.
- Addendum flow: signed form edit → forbidden; addendum → appended block, original struck-through.
- Print empty form: `window.print()` produces printable output with placeholders.
- Meaning validation: `"."` in mandatory field → 422 `MEANING_INVALID { field }`.
- MAP field: lone SBP or DBP → validation error; both → computed.
- Pregnancy-mandatory: female 15–55 rad order requires field; missing → validation error.
- Forms-gate 403: POST ICU order-item without form → 403 `forms_gate`. Complete form → POST succeeds.
- Trigger enforces on direct SQL INSERT (UI-independent test via psql fixture).
- ICU rule is data-only: `rg 'ICU_ADMISSION_CHECKLIST' src/` returns zero hits.
- Post-order instantiation: successful order INSERT spawns matching `clinical_form_instance` rows with correct `due_at`.
- `visit_source` enum exists; `clinic_bookings.source` typed as `visit_source`; `booking_source` untouched.
- Zero direct supabase reads under `src/components/clinical/daylight/forms/` (grep enforced).
- Tests ≥ 16 green.
- See also the added DoD at the end of the plan

Explicit deferrals to Turn 2b

- HIM channel (`him_communication` table, `v_him_comm_thread`, HimCommCard write path).
- Eight module worklist panes (`wl-ems`, `wl-pharmacist`, `wl-admission`, `wl-transfer-discharge`, `wl-floor-manager`, `wl-coder`, `wl-mrd`, `wl-front-office`).

## Confirmation needed before I ship

# Step 2 · Turn 2a — Correction Addendum (append to the plan; overrides where stated)

Split confirmed (2a first — proceed as planned). Six corrections; all schema facts verified against clone @ef9b3eb.

## Y1 — Column names on existing tables

- `form_workflow_binding` column is `trigger` (not `trigger_type`). The view aliases it. All SQL: `b.trigger = 'post_order'`; all TS: read from `trigger` column.
- `clinical_form_instance` already has `cosigned_at`, `cosigned_by` — do not re-add. The plan's other new columns (`paste_ranges jsonb`, `addenda jsonb[]`, `cosign_required boolean`, `cosign_pending_for uuid`) are legitimately new; `cosign_required` may already effectively live on `form_def` — check before duplicating.

## Y2 — Order-item → encounter helper (avoid duplicating the 5-way CASE)

Ship one SQL helper (own migration, before the triggers):

```sql
CREATE OR REPLACE FUNCTION public._order_item_encounter(_tbl text, _order_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE _tbl
    WHEN 'lab_order_item'       THEN (SELECT encounter_id FROM public.lab_order            WHERE id = _order_id)
    WHEN 'radiology_order_item' THEN (SELECT encounter_id FROM public.radiology_order      WHERE id = _order_id)
    WHEN 'service_order_item'   THEN (SELECT encounter_id FROM public.service_order        WHERE id = _order_id)
    WHEN 'ep_order_item'        THEN (SELECT encounter_id FROM public.electrophysiology_order WHERE id = _order_id)
    WHEN 'prescription_item'    THEN (SELECT encounter_id FROM public.prescription         WHERE id = _order_id)
  END
$$;

```

Both triggers call `public._order_item_encounter(TG_TABLE_NAME, NEW.order_id)`. Note `ep_order_item`'s parent is `electrophysiology_order`, NOT `ep_order`.

## Y3 — Binding table extensions (own migration, before the post-order trigger)

`form_workflow_binding` currently lacks `order_item_table` and `service_id` — plan filters by both.

```sql
ALTER TABLE public.form_workflow_binding
  ADD COLUMN IF NOT EXISTS order_item_table text NULL,
  ADD COLUMN IF NOT EXISTS service_id uuid NULL REFERENCES public.service_master(id);

```

NULL semantics = "any" in the filter. Turn 3's Form Builder must expose these in the binding editor (log as Turn 3 dependency).

## Y4 — Clinical flag columns: right home, not `beneficiary`

- `dnr_flag boolean DEFAULT false` and `isolation_precaution text NULL` go on `encounter` (encounter-scoped clinical state, not demographic). DoctorWorklist join updates: `e.dnr_flag`, `e.isolation_precaution`.
- `is_vip boolean DEFAULT false` on `beneficiary` (patient-scoped — this one is fine on beneficiary).
- Schema comment on `encounter.dnr_flag`: "Stub for DNR display; full clinical-attestation model deferred to Batch C. Do not use for clinical decisions without attestation."
- DoctorWorklist literal `false AS is_vip` → `b.is_vip` (grep-checkable).
- `DnrBanner` reads from encounter, not beneficiary. `IsolationChip` reads from encounter.

## Y5 — Alerts route: split display sections

`GET /api/clinical/v1/encounters/$id/alerts` returns:

```
{
  patient: { allergies: [...], conditions_flags: [...], is_vip: boolean },
  encounter: { dnr_flag: boolean, isolation_precaution: string|null }
}

```

`AlertingPopup` renders "Patient background" section and "This encounter" section distinctly. Each row carries its own id so HIM comm deep-links resolve.

## Y6 — Consolidate field renderers under ClinicalForm

Keep as top-level under `daylight/forms/`: `ClinicalForm.tsx`, `AlertingPopup.tsx`, `DnrBanner.tsx`, `IsolationChip.tsx`, `PasteHighlightField.tsx`, `AddendumEditor.tsx`, `PrintEmptyForm.tsx`.

Move under `daylight/forms/fields/` with a single field-type dispatcher: `MapField.tsx`, `FallRiskField.tsx`, `VteIcon.tsx`, `PregnancyMandatoryField.tsx`. `ClinicalForm` reads `form_def.schema` field types and dispatches via a `FIELD_RENDERERS` map. Rationale: Turn 3's Form Builder edits `form_def.schema`; if field renderers scatter, the Builder's field-type dropdown drifts from what actually renders. One registry, one source of truth.

## Environment portability — ICU seed by code, not UUID

Seed the ICU binding using `service_master.code`:

```sql
INSERT INTO public.form_workflow_binding (..., service_id, ...)
SELECT ..., sm.id, ...
FROM public.service_master sm
WHERE sm.code = 'ICU_ADMISSION' AND sm.tenant_id = <demo>
ON CONFLICT DO NOTHING;

```

Seeds run against different UUIDs per environment; symbolic lookup at seed time preserves the binding. Requires `service_master.code` to be stable for ICU admission — if the code doesn't exist yet in the seeded catalog, seed the service_master row first (own migration).

## Added DoD

- [ ] Grep: `trigger_type` appears ONLY in Turn-1's view alias (`b.trigger AS trigger_type`), never in new SQL or new TS reading bindings.
- [ ] `_order_item_encounter()` helper exists and is called by both triggers (grep confirms 2 call sites, no inline CASE).
- [ ] `form_workflow_binding.order_item_table` and `service_id` columns exist before the post-order trigger references them.
- [ ] `encounter.dnr_flag` + `encounter.isolation_precaution` present; `beneficiary.is_vip` present; DoctorWorklist view aliases updated (grep `false AS is_vip` returns 0).
- [ ] `AlertingPopup` renders patient/encounter sections separately.
- [ ] `daylight/forms/fields/` directory with dispatcher exists; 4 field renderers live there; `ClinicalForm` uses the FIELD_RENDERERS registry.
- [ ] ICU seed uses `service_master.code = 'ICU_ADMISSION'`; the service_master row exists (either pre-existing or seeded in this turn).
- [ ] Grep confirms `ICU_ADMISSION_CHECKLIST` appears only in seed SQL, zero hits in `src/`.