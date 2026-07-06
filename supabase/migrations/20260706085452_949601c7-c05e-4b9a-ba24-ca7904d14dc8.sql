-- M04: Extend episode_of_care.status CHECK to add 'delivered','transferred' for maternity.
-- Separate migration from consumers per R1 lesson.
ALTER TABLE public.episode_of_care DROP CONSTRAINT IF EXISTS episode_of_care_status_check;
ALTER TABLE public.episode_of_care
  ADD CONSTRAINT episode_of_care_status_check
  CHECK (status IN ('active','finished','cancelled','delivered','transferred'));