
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accent_preference text NOT NULL DEFAULT 'teal'
    CHECK (accent_preference IN ('teal','sky','coral','violet','amber','emerald','rose'));
