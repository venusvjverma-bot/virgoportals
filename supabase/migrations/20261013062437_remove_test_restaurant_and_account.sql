/*
# Remove the temporary test restaurant and its test account

## Plain English

A throwaway restaurant ("__PROBE__ Kitchen") and one throwaway host account were
created while verifying that the admin can provision a host end to end. Both were
created only for that test and are removed here.

The deletion is matched on the exact test values, so a real restaurant can never
be caught by it. Nothing else is touched.

## Changes

- Deletes the `restaurants` row named `__PROBE__ Kitchen`.
- Deletes the matching Supabase Auth account.

## Important notes

1. The restaurant row is deleted first, which cascades to any dishes it had.
2. The Auth account is matched on the `probe-host-` address pattern so no real
   host can be affected.
3. The test restaurant's uploaded file was already removed through the Storage
   API before this migration. Direct deletion from the storage tables is blocked
   by the platform, so no storage statement appears here.
*/

DELETE FROM public.restaurants WHERE name = '__PROBE__ Kitchen';

DELETE FROM auth.identities
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE 'probe-host-%@example.invalid'
);

DELETE FROM auth.users WHERE email LIKE 'probe-host-%@example.invalid';
