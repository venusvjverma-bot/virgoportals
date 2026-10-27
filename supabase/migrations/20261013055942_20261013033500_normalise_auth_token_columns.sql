/*
# Virgo Portals — normalise auth token columns

## Overview
Supabase Auth (GoTrue) reads `auth.users` rows into non-nullable Go string
fields. Rows inserted directly by the previous migration left the token columns
as NULL, which makes GoTrue fail every login with "Database error querying
schema". This migration sets those columns to empty strings on the migrated
users, matching what GoTrue itself writes.

## 1. Modified table: `auth.users` (migrated users only)
- `confirmation_token`, `recovery_token`, `email_change`,
  `email_change_token_new`, `email_change_token_current` -> '' where NULL.
- `phone_change`, `phone_change_token`, `reauthentication_token` -> '' where NULL.
- `is_super_admin` -> false where NULL.

## 2. Scope
Only rows whose email is the admin or the host are touched, so no unrelated
account is affected. Idempotent: a second run changes nothing.
*/

UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  is_super_admin = COALESCE(is_super_admin, false),
  updated_at = now()
WHERE lower(email) IN ('venusvjverma@gmail.com', 'prince.verma88@gmail.com');
