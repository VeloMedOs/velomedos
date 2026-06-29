DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'service_master_tenant_code_uq') THEN
    EXECUTE 'CREATE UNIQUE INDEX service_master_tenant_code_uq ON public.service_master(tenant_id, internal_code)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'drug_master_tenant_code_uq') THEN
    EXECUTE 'CREATE UNIQUE INDEX drug_master_tenant_code_uq ON public.drug_master(tenant_id, internal_code)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'payer_tenant_code_uq') THEN
    EXECUTE 'CREATE UNIQUE INDEX payer_tenant_code_uq ON public.payer(tenant_id, nphies_payer_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'tpa_tenant_code_uq') THEN
    EXECUTE 'CREATE UNIQUE INDEX tpa_tenant_code_uq ON public.tpa(tenant_id, nphies_tpa_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'policy_tenant_code_uq') THEN
    EXECUTE 'CREATE UNIQUE INDEX policy_tenant_code_uq ON public.policy(tenant_id, policy_number)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'network_tenant_code_uq') THEN
    EXECUTE 'CREATE UNIQUE INDEX network_tenant_code_uq ON public.network(tenant_id, payer_id, name)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'drg_code_version_uq') THEN
    EXECUTE 'CREATE UNIQUE INDEX drg_code_version_uq ON public.drg(drg_code, version)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'prom_instrument_tenant_code_uq') THEN
    EXECUTE 'CREATE UNIQUE INDEX prom_instrument_tenant_code_uq ON public.prom_instrument(tenant_id, key, version)';
  END IF;
END$$;