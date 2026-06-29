-- Expand clinical_role enum with HIS/RCM roles
ALTER TYPE public.clinical_role ADD VALUE IF NOT EXISTS 'front_office';
ALTER TYPE public.clinical_role ADD VALUE IF NOT EXISTS 'rcm';
ALTER TYPE public.clinical_role ADD VALUE IF NOT EXISTS 'approval_officer';
ALTER TYPE public.clinical_role ADD VALUE IF NOT EXISTS 'claims_officer';
ALTER TYPE public.clinical_role ADD VALUE IF NOT EXISTS 'finance';