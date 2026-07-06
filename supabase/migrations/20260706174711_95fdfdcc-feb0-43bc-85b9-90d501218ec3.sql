-- 1) Fix erp_posting_queue check to align with cash_collection_on_post trigger.
ALTER TABLE public.erp_posting_queue
  DROP CONSTRAINT IF EXISTS erp_posting_queue_entity_type_check;
ALTER TABLE public.erp_posting_queue
  ADD CONSTRAINT erp_posting_queue_entity_type_check
  CHECK (entity_type = ANY (ARRAY[
    'deposit_txn'::text,
    'refund'::text,
    'credit_note'::text,
    'remittance'::text,
    'cash_collection'::text
  ]));

-- 2) Demo gate fixtures.
DO $$
DECLARE
  _tenant uuid;
  _ben uuid := '00000000-0000-0000-0000-00000000d001';
  _svc uuid := '00000000-0000-0000-0000-00000000d002';
  _enc_green uuid := '00000000-0000-0000-0000-00000000d010';
  _enc_amber uuid := '00000000-0000-0000-0000-00000000d011';
  _enc_red   uuid := '00000000-0000-0000-0000-00000000d012';
  _so_green uuid := '00000000-0000-0000-0000-00000000d020';
  _so_amber uuid := '00000000-0000-0000-0000-00000000d021';
  _so_red   uuid := '00000000-0000-0000-0000-00000000d022';
  _soi_green uuid := '00000000-0000-0000-0000-00000000d030';
  _soi_amber uuid := '00000000-0000-0000-0000-00000000d031';
  _soi_red_a uuid := '00000000-0000-0000-0000-00000000d032';
  _soi_red_b uuid := '00000000-0000-0000-0000-00000000d033';
  _ch_green uuid := '00000000-0000-0000-0000-00000000d040';
  _ch_amber uuid := '00000000-0000-0000-0000-00000000d041';
  _ch_red_a uuid := '00000000-0000-0000-0000-00000000d042';
  _ch_red_b uuid := '00000000-0000-0000-0000-00000000d043';
  _auth_req uuid := '00000000-0000-0000-0000-00000000d050';
BEGIN
  SELECT id INTO _tenant FROM public.corporate_accounts WHERE slug = 'connect-care' LIMIT 1;
  IF _tenant IS NULL THEN
    RAISE NOTICE 'connect-care tenant not found; skipping demo fixtures';
    RETURN;
  END IF;

  INSERT INTO public.beneficiary (id, tenant_id, full_name, dob, gender, document_type, document_id)
  VALUES (_ben, _tenant, 'Demo · Gate Patient', '1990-01-01', 'male', 'national_id', 'DEMO-GATE-0001')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.service_master (id, tenant_id, internal_code, name, service_type)
  VALUES (_svc, _tenant, 'DEMO-CONSULT', 'Demo consultation', 'services')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.encounter (id, tenant_id, beneficiary_id, encounter_number, class)
  VALUES
    (_enc_green, _tenant, _ben, 'ENC-DEMO-GREEN', 'AMB'),
    (_enc_amber, _tenant, _ben, 'ENC-DEMO-AMBER', 'EMER'),
    (_enc_red,   _tenant, _ben, 'ENC-DEMO-RED',   'AMB')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.service_order (id, tenant_id, encounter_id)
  VALUES
    (_so_green, _tenant, _enc_green),
    (_so_amber, _tenant, _enc_amber),
    (_so_red,   _tenant, _enc_red)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.service_order_item (id, tenant_id, order_id, service_id, status)
  VALUES
    (_soi_green, _tenant, _so_green, _svc, 'ordered'),
    (_soi_amber, _tenant, _so_amber, _svc, 'ordered'),
    (_soi_red_a, _tenant, _so_red,   _svc, 'ordered'),
    (_soi_red_b, _tenant, _so_red,   _svc, 'ordered')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.charge_item
    (id, tenant_id, encounter_id, order_item_table, order_item_id, source_type,
     service_id, internal_code, pricing_mode, description,
     unit_price_minor, quantity, net_minor, status)
  VALUES
    (_ch_green, _tenant, _enc_green, 'service_order_item', _soi_green, 'service',
      _svc, 'DEMO-CONSULT', 'insured', 'Demo insured consult (green)',
      15000, 1, 15000, 'ordered'),
    (_ch_amber, _tenant, _enc_amber, 'service_order_item', _soi_amber, 'service',
      _svc, 'DEMO-CONSULT', 'insured', 'Demo ER consult (amber)',
      20000, 1, 20000, 'ordered'),
    (_ch_red_a, _tenant, _enc_red,   'service_order_item', _soi_red_a, 'service',
      _svc, 'DEMO-CONSULT', 'cash',    'Demo cash consult A (green)',
      10000, 1, 10000, 'ordered'),
    (_ch_red_b, _tenant, _enc_red,   'service_order_item', _soi_red_b, 'service',
      _svc, 'DEMO-CONSULT', 'cash',    'Demo cash consult B (red)',
      10000, 1, 10000, 'ordered')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.authorization_request (id, tenant_id, encounter_id, status)
  VALUES (_auth_req, _tenant, _enc_green, 'approved')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.authorization_item (id, tenant_id, authorization_request_id, source, charge_item_id, quantity, decision)
  VALUES ('00000000-0000-0000-0000-00000000d051', _tenant, _auth_req, 'service', _ch_green, 1, 'approved')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.rcm_gate_exception
    (id, tenant_id, encounter_id, charge_item_id, exception_type, reason_code,
     reason_text, manual_approved_minor)
  VALUES ('00000000-0000-0000-0000-00000000d060', _tenant, _enc_amber, _ch_amber,
          'emergency_override', 'ctas_1_2',
          'Demo: CTAS 1-2 emergency override', 20000)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.cash_collection
    (id, tenant_id, receipt_no, beneficiary_id, encounter_id, method,
     gross_minor, net_collected_minor, status, posted_at)
  VALUES ('00000000-0000-0000-0000-00000000d070', _tenant,
          'RCP-DEMO-GATE-0001', _ben, _enc_red, 'cash',
          10000, 10000, 'posted', now())
  ON CONFLICT (id) DO NOTHING;
END $$;