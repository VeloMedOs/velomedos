-- Batch B · Clinical Spine Turn-1 — worklist views + tracking columns

ALTER TABLE public.authorization_communication
  ADD COLUMN IF NOT EXISTS read_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS read_by uuid NULL;

ALTER TABLE public.denial_communication
  ADD COLUMN IF NOT EXISTS read_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS read_by uuid NULL;

ALTER TABLE public.clinic_bookings
  ADD COLUMN IF NOT EXISTS origin_encounter_id uuid NULL REFERENCES public.encounter(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text NULL;

ALTER TABLE public.service_master
  ADD COLUMN IF NOT EXISTS execution_venue text NULL;

CREATE OR REPLACE VIEW public.v_rcm_comm_thread AS
  SELECT
    ac.id                                                AS id,
    ac.tenant_id                                         AS tenant_id,
    ar.encounter_id                                      AS encounter_id,
    (ac.payload ->> 'order_item_ref')                    AS order_item_ref,
    ac.direction                                         AS direction,
    ac.body                                              AS message,
    (ac.payload ->> 'status_pushed')                     AS status_pushed,
    (ac.payload ->> 'author_role')                       AS author_role,
    (ac.direction = 'inbound' AND ac.read_at IS NULL)    AS unread,
    'authorization'::text                                AS kind,
    ac.created_at                                        AS created_at
    FROM public.authorization_communication ac
    JOIN public.authorization_request ar ON ar.id = ac.authorization_request_id
UNION ALL
  SELECT
    dc.id, dc.tenant_id, cl.encounter_id,
    NULL::text, dc.direction, dc.body,
    NULL::text, NULL::text,
    (dc.direction = 'inbound' AND dc.read_at IS NULL),
    'denial'::text, dc.occurred_at
    FROM public.denial_communication dc
    JOIN public.denial_case dn ON dn.id = dc.denial_case_id
    LEFT JOIN public.claim cl ON cl.id = dn.claim_id
UNION ALL
  SELECT
    e.id, e.tenant_id, e.encounter_id,
    e.charge_item_id::text, 'outbound'::text,
    'Emergency override open — retrospective auth pending'::text,
    'released_by_exception'::text,
    COALESCE(e.granted_role, 'rcm'),
    true, 'exception_escalation'::text, e.created_at
    FROM public.rcm_gate_exception e
   WHERE e.exception_type = 'emergency_override'
     AND e.closed_at IS NULL
     AND e.reconciled_at IS NULL;

GRANT SELECT ON public.v_rcm_comm_thread TO authenticated;

CREATE OR REPLACE VIEW public.v_doctor_worklist AS
SELECT
  e.tenant_id, e.id AS encounter_id, e.class, e.encounter_number, e.status, e.journey_state,
  e.period_start,
  EXTRACT(EPOCH FROM (now() - e.period_start))::int AS waiting_seconds,
  b.id AS beneficiary_id,
  b.patient_file_no AS mrn,
  COALESCE(b.full_name, trim(concat_ws(' ', b.first_name, b.middle_name, b.last_name))) AS name,
  CASE WHEN b.dob IS NULL THEN NULL ELSE EXTRACT(YEAR FROM age(b.dob))::int END AS age,
  b.gender,
  NULL::text AS token,
  false AS is_vip,
  COALESCE(gate.billed_ct, 0)   AS billed_orders,
  COALESCE(gate.released_ct, 0) AS released_orders,
  COALESCE(gate.locked_ct, 0)   AS locked_orders,
  COALESCE(auth.pending_ct, 0)  AS pending_authorizations,
  COALESCE(cm.unread_ct, 0)     AS unread_rcm_comms,
  ct.physician_name             AS attending_physician
FROM public.encounter e
JOIN public.beneficiary b ON b.id = e.beneficiary_id
LEFT JOIN LATERAL (
  SELECT
    count(*) FILTER (WHERE gate_state = 'billed')                AS billed_ct,
    count(*) FILTER (WHERE gate_state = 'released_by_exception') AS released_ct,
    count(*) FILTER (WHERE gate_state = 'locked')                AS locked_ct
    FROM public.v_order_item_gate g WHERE g.encounter_id = e.id
) gate ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS pending_ct
    FROM public.authorization_request ar
   WHERE ar.encounter_id = e.id
     AND ar.status IN ('new','scrubbing','ready_to_submit','submitted','queued_at_payer','in_review','more_info_requested','partially_approved')
) auth ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS unread_ct
    FROM public.v_rcm_comm_thread c
   WHERE c.encounter_id = e.id AND c.unread = true
) cm ON true
LEFT JOIN LATERAL (
  SELECT p.full_name AS physician_name
    FROM public.encounter_care_team t
    LEFT JOIN public.profiles p ON p.id = t.practitioner_user_id
   WHERE t.encounter_id = e.id
     AND t.role IN ('physician','attending','mrp')
   ORDER BY t.is_primary DESC NULLS LAST, t.period_start DESC NULLS LAST
   LIMIT 1
) ct ON true
WHERE e.status NOT IN ('cancelled','finished');

GRANT SELECT ON public.v_doctor_worklist TO authenticated;

CREATE OR REPLACE VIEW public.v_nursing_workbench AS
SELECT
  e.tenant_id, e.id AS encounter_id, e.class, e.encounter_number,
  b.patient_file_no AS mrn,
  COALESCE(b.full_name, trim(concat_ws(' ', b.first_name, b.middle_name, b.last_name))) AS name,
  NULL::text AS ward,
  NULL::text AS bed,
  vitals.latest_recorded_at AS latest_vitals_at,
  CASE WHEN vitals.latest_recorded_at IS NULL
            OR vitals.latest_recorded_at < now() - interval '4 hours'
       THEN 1 ELSE 0 END AS vitals_due,
  COALESCE(forms.pending_nurse_ct, 0) AS assessments_due,
  0::int AS emar_due,
  0::int AS care_tasks_open,
  COALESCE(cm.unread_ct, 0) AS unread_rcm_comms
FROM public.encounter e
JOIN public.beneficiary b ON b.id = e.beneficiary_id
LEFT JOIN LATERAL (
  SELECT max(recorded_at) AS latest_recorded_at
    FROM public.vitals_observation v WHERE v.encounter_id = e.id
) vitals ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS pending_nurse_ct
    FROM public.clinical_form_instance i
   WHERE i.encounter_id = e.id
     AND i.status IN ('pending','in_progress')
     AND i.assigned_role IN ('nurse','care_team')
) forms ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS unread_ct
    FROM public.v_rcm_comm_thread c
   WHERE c.encounter_id = e.id AND c.unread = true
) cm ON true
WHERE e.status NOT IN ('cancelled','finished');

GRANT SELECT ON public.v_nursing_workbench TO authenticated;

CREATE OR REPLACE VIEW public.v_clinical_forms_worklist AS
SELECT
  i.tenant_id, i.id AS instance_id, i.encounter_id, e.class,
  i.form_def_id, d.code, d.title,
  b.trigger AS trigger_type,
  b.mandatory, b.cosign_required,
  CASE WHEN b.trigger = 'pre'  THEN 'pre_order'
       WHEN b.trigger = 'post' THEN 'post_order'
       ELSE 'standalone' END AS gate_type,
  b.assignee_role AS classification,
  i.assigned_role, i.status, i.due_at,
  (i.due_at IS NOT NULL
     AND i.status NOT IN ('submitted','cosigned')
     AND i.due_at < now()) AS is_overdue,
  i.submitted_at, i.cosigned_at, i.created_at
FROM public.clinical_form_instance i
JOIN public.form_def d ON d.id = i.form_def_id
LEFT JOIN public.encounter e ON e.id = i.encounter_id
LEFT JOIN LATERAL (
  SELECT b2.trigger, b2.mandatory, b2.cosign_required, b2.assignee_role
    FROM public.form_workflow_binding b2
   WHERE b2.form_def_id = i.form_def_id
     AND b2.tenant_id = i.tenant_id
     AND b2.active = true
     AND (b2.encounter_class IS NULL OR b2.encounter_class = e.class)
   ORDER BY (b2.encounter_class IS NOT NULL) DESC, b2.updated_at DESC
   LIMIT 1
) b ON true;

GRANT SELECT ON public.v_clinical_forms_worklist TO authenticated;