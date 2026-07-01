
ALTER TYPE public.deposit_status ADD VALUE IF NOT EXISTS 'held';
ALTER TYPE public.deposit_status ADD VALUE IF NOT EXISTS 'partially_applied';
ALTER TYPE public.deposit_status ADD VALUE IF NOT EXISTS 'transferred';
