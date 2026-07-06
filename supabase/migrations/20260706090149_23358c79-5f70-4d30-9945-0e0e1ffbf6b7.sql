-- M13: Add maternity_protocol.class_id for payer×class resolution (HCA-0242).
ALTER TABLE public.maternity_protocol
  ADD COLUMN IF NOT EXISTS class_id uuid NULL REFERENCES public.insurance_class(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS maternity_protocol_class_idx ON public.maternity_protocol(class_id) WHERE class_id IS NOT NULL;