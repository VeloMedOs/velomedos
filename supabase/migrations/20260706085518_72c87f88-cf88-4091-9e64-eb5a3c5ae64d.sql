-- M05: Extend pricing_rule_scope enum with 'referral' and 'pbm'.
-- Must precede M08 (PBM seeds) and M14 (referral A-E seeds).
-- approval_rule / need_approval_rule / not_covered_rule use plain text scope columns with no CHECK — no DDL needed there.
ALTER TYPE public.pricing_rule_scope ADD VALUE IF NOT EXISTS 'referral';
ALTER TYPE public.pricing_rule_scope ADD VALUE IF NOT EXISTS 'pbm';