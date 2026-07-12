-- M-S5T2-01 · referral.origin_source (audit trail)
ALTER TABLE public.referral
  ADD COLUMN IF NOT EXISTS origin_source text NULL;

-- M-S5T2-02 · referral_target.source_key + tenant-scoped UNIQUE index
ALTER TABLE public.referral_target
  ADD COLUMN IF NOT EXISTS source_key text NULL;

CREATE UNIQUE INDEX IF NOT EXISTS referral_target_source_key_uidx
  ON public.referral_target(tenant_id, source_key)
  WHERE source_key IS NOT NULL;