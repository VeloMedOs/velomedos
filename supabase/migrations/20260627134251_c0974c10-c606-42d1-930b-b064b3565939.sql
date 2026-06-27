
-- 1) Broaden seed-roles trigger to recognize the new superadmin domain
CREATE OR REPLACE FUNCTION public.assign_seed_roles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant uuid;
  _domain text;
BEGIN
  IF NEW.email IS NULL THEN RETURN NEW; END IF;
  _domain := lower(split_part(NEW.email,'@',2));

  IF _domain IN ('velomed.io','velomedos.com') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'superadmin')
      ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT DO NOTHING;
  END IF;

  IF lower(NEW.email) = 'admin@connectcare.sa' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'business_admin')
      ON CONFLICT DO NOTHING;
    SELECT id INTO _tenant FROM public.corporate_accounts WHERE slug = 'connect-care' LIMIT 1;
    IF _tenant IS NOT NULL THEN
      INSERT INTO public.tenant_members (tenant_id, user_id, role)
        VALUES (_tenant, NEW.id, 'admin')
        ON CONFLICT DO NOTHING;
      UPDATE public.corporate_accounts SET owner_user_id = NEW.id WHERE id = _tenant AND owner_user_id IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Provision the requested superadmin account (idempotent) with a confirmed email
DO $$
DECLARE
  _uid uuid;
  _email text := 'superadmin@velomedos.com';
  _pw    text := 'UmedMi@123';
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = _email;

  IF _uid IS NULL THEN
    _uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', _uid, 'authenticated', 'authenticated',
      _email, crypt(_pw, gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
      jsonb_build_object('full_name','VeloMed Superadmin'),
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), _uid,
            jsonb_build_object('sub', _uid::text, 'email', _email, 'email_verified', true),
            'email', _uid::text, now(), now(), now());
  ELSE
    UPDATE auth.users
       SET encrypted_password = crypt(_pw, gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           updated_at = now()
     WHERE id = _uid;
  END IF;

  -- Ensure profile + roles exist (in case the trigger fired before this domain rule existed)
  INSERT INTO public.profiles (id, full_name, email, default_role)
    VALUES (_uid, 'VeloMed Superadmin', _email, 'patient')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'superadmin') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'admin')      ON CONFLICT DO NOTHING;
END $$;
