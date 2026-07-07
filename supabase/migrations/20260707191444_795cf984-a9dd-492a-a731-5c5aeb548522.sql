-- Step 3 Turn 1 Migration 1 · booking_status enum extension (R1: enum alone, first)
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'arrived';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'in_consult';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'no_show';