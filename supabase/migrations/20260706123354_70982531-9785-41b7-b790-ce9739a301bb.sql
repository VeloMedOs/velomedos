
-- M14 · Seeds only. No DDL / no type changes.

-- 1) Per-tenant rcm_admin_config defaults
DO $$
DECLARE t RECORD;
DECLARE defaults jsonb := jsonb_build_object(
  'ip_deposit_min_percent',      to_jsonb(35),
  'self_pay_release',            to_jsonb('full'::text),
  'override_roles',              to_jsonb(ARRAY['rcm']),
  'er_supply_days_max',          to_jsonb(7),
  'wallet_block_scope',          to_jsonb('all_orders'::text),
  'op_dispense_days_max',        to_jsonb(14),
  'installment_policy',          '{}'::jsonb,
  'indication_severity_default', to_jsonb('block'::text)
);
DECLARE k text;
DECLARE v jsonb;
BEGIN
  FOR t IN SELECT id FROM public.corporate_accounts LOOP
    FOR k, v IN SELECT * FROM jsonb_each(defaults) LOOP
      INSERT INTO public.rcm_admin_config (tenant_id, key, value)
      VALUES (t.id, k, v)
      ON CONFLICT (tenant_id, key) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- 2) PBM global rules (tenant_id NULL, active=true)
INSERT INTO public.pricing_rule (tenant_id, name, scope, priority, condition, action, active)
VALUES
  (NULL,'R-PBM1 Formulary listed','pbm',10,
   '{"require_formulary":true}'::jsonb,
   '{"block_when_missing":true,"code":"FORMULARY_MISSING"}'::jsonb, true),
  (NULL,'R-PBM2a Indication ICD10 match','pbm',20,
   '{"require_indication":true}'::jsonb,
   '{"block_when_missing":true,"code":"INDICATION_MISSING"}'::jsonb, true),
  (NULL,'R-PBM2b Off-label needs override','pbm',30,
   '{"off_label":true}'::jsonb,
   '{"require_override":true,"code":"INDICATION_OFFLABEL"}'::jsonb, true),
  (NULL,'R-PBM3 Quantity limit','pbm',40,
   '{"quantity_limit":true}'::jsonb,
   '{"cap_from":"drug_master.max_daily_dose","code":"QTY_LIMIT"}'::jsonb, true),
  (NULL,'R-PBM4 DUR interaction check','pbm',50,
   '{"dur":true}'::jsonb,
   '{"warn":true,"code":"DUR_WARNING"}'::jsonb, true),
  (NULL,'R-PBM5 Prior authorization','pbm',60,
   '{"pa_required":true}'::jsonb,
   '{"require_auth":true,"code":"PA_REQUIRED"}'::jsonb, true),
  (NULL,'R-PBM6 Step therapy','pbm',70,
   '{"step_therapy":true}'::jsonb,
   '{"require_prior_step":true,"code":"STEP_REQUIRED"}'::jsonb, true)
ON CONFLICT DO NOTHING;

-- 3) Referral global rules A..E
INSERT INTO public.pricing_rule (tenant_id, name, scope, priority, condition, action, active)
VALUES
  (NULL,'Rule A Specialty mismatch','referral',10,
   '{"specialty_mismatch":true}'::jsonb,
   '{"block":true,"code":"REF_SPECIALTY_MISMATCH"}'::jsonb, true),
  (NULL,'Rule B 14-day rule','referral',20,
   '{"days_since_referral_max":14}'::jsonb,
   '{"require_active":true,"code":"REF_STALE"}'::jsonb, true),
  (NULL,'Rule C Dental visit limits','referral',30,
   '{"category":"dental","visit_limit":true}'::jsonb,
   '{"cap_from":"policy.dental_visits","code":"REF_DENTAL_LIMIT"}'::jsonb, true),
  (NULL,'Rule D Cross-network referral','referral',40,
   '{"cross_network":true}'::jsonb,
   '{"require_auth":true,"code":"REF_CROSS_NETWORK"}'::jsonb, true),
  (NULL,'Rule E Class exclusion','referral',50,
   '{"class_exclusion":true}'::jsonb,
   '{"block":true,"code":"REF_CLASS_EXCLUDED"}'::jsonb, true)
ON CONFLICT DO NOTHING;
