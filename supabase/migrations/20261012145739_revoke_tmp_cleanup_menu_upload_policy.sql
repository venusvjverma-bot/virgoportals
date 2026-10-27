/*
# Revoke the temporary cleanup policy

## Overview
Removes the short-lived DELETE policy that was added only to delete a test menu
upload during verification. This restores the original storage security model.

## 1. Security
- Drops `tmp_delete_menu_uploads` from storage.objects.
- Read and insert access to the `dish-images` bucket are unchanged.
- No other policy, table, or grant is touched.
*/

DROP POLICY IF EXISTS "tmp_delete_menu_uploads" ON storage.objects;
