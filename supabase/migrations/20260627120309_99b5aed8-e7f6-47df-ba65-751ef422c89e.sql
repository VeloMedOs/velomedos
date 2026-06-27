
-- 1) Extend roles (must be committed before being used in policies)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'superadmin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'business_admin';
