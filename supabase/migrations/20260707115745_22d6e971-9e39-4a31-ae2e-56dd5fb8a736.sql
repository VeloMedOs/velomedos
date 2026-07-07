
-- Turn 2b Migration 1 — view residual fixes + form_workflow_binding.classification column.

-- ── form_workflow_binding.classification ──────────────────────────────────
ALTER TABLE public.form_workflow_binding
  ADD COLUMN IF NOT EXISTS classification text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'form_workflow_binding_classification_chk'
  ) THEN
    ALTER TABLE public.form_workflow_binding
      ADD CONSTRAINT form_workflow_binding_classification_chk
      CHECK (classification IS NULL OR classification IN ('nurse','care_team','counter','specialty'));
  END IF;
END $$;

UPDATE public.form_workflow_binding
   SET classification = CASE assignee_role
     WHEN 'nurse' THEN 'nurse'
     WHEN 'physician' THEN 'care_team'
     WHEN 'front_office' THEN 'counter'
     ELSE 'specialty'
   END
 WHERE classification IS NULL;

-- ── Recreate views (DROP + CREATE to allow column reordering/adds). ─────
-- v_doctor_worklist has no dependents; v_nursing_workbench likewise;
-- v_clinical_forms_worklist likewise. Safe to drop.
DROP VIEW IF EXISTS public.v_doctor_worklist CASCADE;
DROP VIEW IF EXISTS public.v_nursing_workbench CASCADE;
DROP VIEW IF EXISTS public.v_clinical_forms_worklist CASCADE;

CREATE VIEW public.v_doctor_worklist
WITH (security_invoker = true) AS
SELECT
  e.tenant_id,
  e.id AS encounter_id,
  e.class,
  e.encounter_number,
  e.status,
  e.journey_state,
  e.period_start,
  (EXTRACT(epoch FROM (now() - e.period_start)))::integer AS waiting_seconds,
  b.id AS beneficiary_id,
  b.patient_file_no AS mrn,
  COALESCE(b.full_name, TRIM(BOTH FROM concat_ws(' ', b.first_name, b.middle_name, b.last_name))) AS name,
  CASE
    WHEN b.dob IS NULL THEN NULL::integer
    ELSE (EXTRACT(year FROM age(b.dob::timestamp with time zone)))::integer
  END AS age,
  b.gender,
  NULL::text AS token,
  COALESCE(b.is_vip, false) AS is_vip,
  e.dnr_flag,
  e.isolation_precaution,
  eh.discharge_disposition,
  NULL::text AS ems_status,
  COALESCE(gate.billed_ct, 0::bigint) AS billed_orders,
  COALESCE(gate.released_ct, 0::bigint) AS released_orders,
  COALESCE(gate.locked_ct, 0::bigint) AS locked_orders,
  COALESCE(auth.pending_ct, 0::bigint) AS pending_authorizations,
  COALESCE(cm.unread_ct, 0::bigint) AS unread_rcm_comms,
  ct.physician_name AS attending_physician
FROM public.encounter e
JOIN public.beneficiary b ON b.id = e.beneficiary_id
LEFT JOIN public.encounter_hospitalization eh ON eh.encounter_id = e.id
LEFT JOIN LATERAL (
  SELECT
    count(*) FILTER (WHERE g.gate_state = 'billed'::public.rcm_gate_state) AS billed_ct,
    count(*) FILTER (WHERE g.gate_state = 'released_by_exception'::public.rcm_gate_state) AS released_ct,
    count(*) FILTER (WHERE g.gate_state = 'locked'::public.rcm_gate_state) AS locked_ct
  FROM public.v_order_item_gate g
  WHERE g.encounter_id = e.id
) gate ON TRUE
LEFT JOIN LATERAL (
  SELECT count(*) AS pending_ct
  FROM public.authorization_request ar
  WHERE ar.encounter_id = e.id
    AND ar.status = ANY (ARRAY[
      'new'::public.authorization_status,
      'scrubbing'::public.authorization_status,
      'ready_to_submit'::public.authorization_status,
      'submitted'::public.authorization_status,
      'queued_at_payer'::public.authorization_status,
      'in_review'::public.authorization_status,
      'more_info_requested'::public.authorization_status,
      'partially_approved'::public.authorization_status
    ])
) auth ON TRUE
LEFT JOIN LATERAL (
  SELECT count(*) AS unread_ct
  FROM public.v_rcm_comm_thread c
  WHERE c.encounter_id = e.id AND c.unread = true
) cm ON TRUE
LEFT JOIN LATERAL (
  SELECT p.full_name AS physician_name
  FROM public.encounter_care_team t
  LEFT JOIN public.profiles p ON p.id = t.practitioner_user_id
  WHERE t.encounter_id = e.id
    AND t.role = ANY (ARRAY['physician','attending','mrp'])
  ORDER BY t.is_primary DESC NULLS LAST, t.period_start DESC NULLS LAST
  LIMIT 1
) ct ON TRUE
WHERE e.status <> ALL (ARRAY['cancelled','finished']);

GRANT SELECT ON public.v_doctor_worklist TO authenticated;

CREATE VIEW public.v_nursing_workbench
WITH (security_invoker = true) AS
SELECT
  e.tenant_id,
  e.id AS encounter_id,
  e.class,
  e.encounter_number,
  b.patient_file_no AS mrn,
  COALESCE(b.full_name, TRIM(BOTH FROM concat_ws(' ', b.first_name, b.middle_name, b.last_name))) AS name,
  NULL::text AS ward,
  NULL::text AS bed,
  vitals.latest_recorded_at AS latest_vitals_at,
  CASE
    WHEN vitals.latest_recorded_at IS NULL
      OR vitals.latest_recorded_at < (now() - interval '4 hours') THEN 1
    ELSE 0
  END AS vitals_due,
  COALESCE(forms.pending_nurse_ct, 0::bigint) AS assessments_due,
  0 AS emar_due,
  0 AS care_tasks_open,
  COALESCE(cm.unread_ct, 0::bigint) AS unread_rcm_comms
FROM public.encounter e
JOIN public.beneficiary b ON b.id = e.beneficiary_id
LEFT JOIN LATERAL (
  SELECT max(v.recorded_at) AS latest_recorded_at
  FROM public.vitals_observation v
  WHERE v.encounter_id = e.id
) vitals ON TRUE
LEFT JOIN LATERAL (
  SELECT count(*) AS pending_nurse_ct
  FROM public.clinical_form_instance i
  WHERE i.encounter_id = e.id
    AND i.status = ANY (ARRAY['pending','in_progress'])
    AND i.assigned_role = ANY (ARRAY['nurse','care_team'])
) forms ON TRUE
LEFT JOIN LATERAL (
  SELECT count(*) AS unread_ct
  FROM public.v_rcm_comm_thread c
  WHERE c.encounter_id = e.id AND c.unread = true
) cm ON TRUE
WHERE e.status <> ALL (ARRAY['cancelled','finished']);

GRANT SELECT ON public.v_nursing_workbench TO authenticated;

CREATE VIEW public.v_clinical_forms_worklist
WITH (security_invoker = true) AS
SELECT
  i.tenant_id,
  i.id AS instance_id,
  i.encounter_id,
  e.class,
  i.form_def_id,
  d.code,
  d.title,
  b.trigger AS trigger_type,
  b.mandatory,
  b.cosign_required,
  CASE
    WHEN b.trigger = 'pre'  THEN 'pre_order'
    WHEN b.trigger = 'post' THEN 'post_order'
    ELSE 'standalone'
  END AS gate_type,
  b.classification,
  i.assigned_role,
  i.status,
  i.due_at,
  ((i.due_at IS NOT NULL)
    AND (i.status <> ALL (ARRAY['submitted','cosigned']))
    AND (i.due_at < now())) AS is_overdue,
  GREATEST(0, EXTRACT(day FROM (now() - i.due_at))::int) AS overdue_days,
  i.submitted_at,
  i.cosigned_at,
  i.created_at
FROM public.clinical_form_instance i
JOIN public.form_def d ON d.id = i.form_def_id
LEFT JOIN public.encounter e ON e.id = i.encounter_id
LEFT JOIN LATERAL (
  SELECT b2.trigger, b2.mandatory, b2.cosign_required, b2.classification
  FROM public.form_workflow_binding b2
  WHERE b2.form_def_id = i.form_def_id
    AND b2.tenant_id = i.tenant_id
    AND b2.active = true
    AND (b2.encounter_class IS NULL OR b2.encounter_class = e.class)
  ORDER BY (b2.encounter_class IS NOT NULL) DESC, b2.updated_at DESC
  LIMIT 1
) b ON TRUE;

GRANT SELECT ON public.v_clinical_forms_worklist TO authenticated;
