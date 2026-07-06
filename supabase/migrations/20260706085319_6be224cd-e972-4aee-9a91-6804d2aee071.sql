-- M01: Enum types for billed gate + exceptions.
-- Must precede rcm_gate_exception table (M07) and v_order_item_gate view.
CREATE TYPE public.rcm_gate_state AS ENUM ('locked','released_by_exception','billed');

CREATE TYPE public.rcm_gate_exception_type AS ENUM (
  'emergency_override',
  'partial_deposit_override',
  'installment_override',
  'clinical_urgency',
  'mrp_verbal_order',
  'newborn_inherit',
  'ineligibility_workflow',
  'config_no_auth',
  'indication_override',
  'admin_override'
);

CREATE TYPE public.rcm_gate_reason_code AS ENUM (
  'ctas_1_2',
  'ipd_partial_deposit',
  'er_criticality',
  'installment_plan',
  'stat_order',
  'mrp_unavailable',
  'newborn_mother_coverage',
  'referral_pending',
  'newborn_pending',
  'emergency_pending',
  'in_network_no_auth',
  'pbm_indication_missing',
  'ip_deposit_below_threshold',
  'admin_manual'
);