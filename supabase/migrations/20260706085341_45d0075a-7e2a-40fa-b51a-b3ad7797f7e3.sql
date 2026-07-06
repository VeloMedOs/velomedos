-- M02: Extend public.clinical_role with Batch C values (pharmacy/lab/BB/radiology/OR/etc.)
-- Separate migration from any consumer (R1 enum lesson). Existing roles reused: pharmacist, radiologist, lab_tech.
ALTER TYPE public.clinical_role ADD VALUE IF NOT EXISTS 'lab_doctor';
ALTER TYPE public.clinical_role ADD VALUE IF NOT EXISTS 'bb_technician';
ALTER TYPE public.clinical_role ADD VALUE IF NOT EXISTS 'bb_physician';
ALTER TYPE public.clinical_role ADD VALUE IF NOT EXISTS 'rad_technician';
ALTER TYPE public.clinical_role ADD VALUE IF NOT EXISTS 'or_nurse';
ALTER TYPE public.clinical_role ADD VALUE IF NOT EXISTS 'cath_nurse';
ALTER TYPE public.clinical_role ADD VALUE IF NOT EXISTS 'anesthetist';
ALTER TYPE public.clinical_role ADD VALUE IF NOT EXISTS 'labour_nurse';
ALTER TYPE public.clinical_role ADD VALUE IF NOT EXISTS 'nursery_nurse';
ALTER TYPE public.clinical_role ADD VALUE IF NOT EXISTS 'injection_staff';