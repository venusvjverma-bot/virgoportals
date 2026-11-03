/*
# Tighten privileges on combo tables

## What this changes
The Supabase project grants every table in the public schema full privileges to the anon, authenticated and service_role roles by default. The combo tables created in the previous migration inherited those defaults. This migration removes the unused privileges so the combo tables match the intended access model.

## Changed privileges
1. anon: all privileges removed from combos and combo_groups. Visitors read combos only through the server function, never directly.
2. authenticated: TRUNCATE, REFERENCES and TRIGGER removed. SELECT, INSERT, UPDATE and DELETE remain, and row level security still restricts rows to the restaurant owner or an admin.
3. service_role: TRUNCATE, REFERENCES and TRIGGER removed. SELECT, INSERT, UPDATE and DELETE remain for server functions.

## Security notes
1. No policies or table structures are changed.
2. No data is modified or deleted.
3. Row level security stays enabled on both tables.
*/

REVOKE ALL ON combos FROM anon;
REVOKE ALL ON combo_groups FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON combos FROM authenticated, service_role;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON combo_groups FROM authenticated, service_role;
