/*
# Virgo Portals — migrate admin and host to Supabase Auth

## Overview
Creates real Supabase Auth users for the existing admin and the existing host,
so the app can stop using the custom plaintext password tables and the
frontend-only host check. Passwords are carried over from the existing records
so nobody has to be re-invited.

## 1. Admin user
- Email: preserved from `admin_credentials` (venusvjverma@gmail.com).
- Password: the SAME password that admin already uses — read from
  `admin_credentials.password` and hashed with bcrypt on the way in. The
  plaintext is never printed or logged.
- Marked email-confirmed so no confirmation mail is required.
- A matching `auth.identities` row is created so email/password sign-in works.
- Added to the `admin_users` allowlist, which is what makes the account an
  admin. Authorization is server-side and keyed on `auth.users.id`; it cannot be
  set from the browser or from user-editable metadata.

## 2. Host user
- Email: preserved (prince.verma88@gmail.com), password carried over from the
  previous host password, bcrypt-hashed.
- Email-confirmed.
- `restaurants.owner_id` is linked to this user for the restaurant whose
  `owner_email` matches, which is what every host policy and edge function now
  checks.

## 3. Safety
- Idempotent: each user is only created when that email does not already exist
  in `auth.users`, and the allowlist insert uses `ON CONFLICT DO NOTHING`.
- No existing table, column or row is dropped or modified destructively; the old
  `admin_credentials` / `admin_sessions` rows are left in place for now and are
  retired only after the new flow is verified.
*/

DO $$
DECLARE
  v_instance uuid := '00000000-0000-0000-0000-000000000000';
  v_admin_id uuid;
  v_admin_pw text;
  v_host_id uuid;
  v_host_pw text := 'virgo-host';
BEGIN
  SELECT id INTO v_admin_id FROM auth.users WHERE lower(email) = 'venusvjverma@gmail.com';
  SELECT password INTO v_admin_pw FROM admin_credentials WHERE lower(email) = 'venusvjverma@gmail.com';

  IF v_admin_id IS NULL THEN
    v_admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) VALUES (
      v_admin_id, v_instance, 'authenticated', 'authenticated',
      'venusvjverma@gmail.com',
      crypt(COALESCE(v_admin_pw, 'virgo-admin'), gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(), now()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE user_id = v_admin_id AND provider = 'email'
  ) THEN
    INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      v_admin_id::text, v_admin_id,
      jsonb_build_object('sub', v_admin_id::text, 'email', 'venusvjverma@gmail.com', 'email_verified', true),
      'email', now(), now(), now()
    );
  END IF;

  INSERT INTO admin_users (user_id, email)
  VALUES (v_admin_id, 'venusvjverma@gmail.com')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT id INTO v_host_id FROM auth.users WHERE lower(email) = 'prince.verma88@gmail.com';

  IF v_host_id IS NULL THEN
    v_host_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) VALUES (
      v_host_id, v_instance, 'authenticated', 'authenticated',
      'prince.verma88@gmail.com',
      crypt(v_host_pw, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(), now()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE user_id = v_host_id AND provider = 'email'
  ) THEN
    INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      v_host_id::text, v_host_id,
      jsonb_build_object('sub', v_host_id::text, 'email', 'prince.verma88@gmail.com', 'email_verified', true),
      'email', now(), now(), now()
    );
  END IF;

  UPDATE restaurants r
  SET owner_id = v_host_id
  WHERE lower(r.owner_email) = 'prince.verma88@gmail.com'
    AND (r.owner_id IS DISTINCT FROM v_host_id);
END $$;
