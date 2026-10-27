/*
# Temporary cleanup policy for test menu uploads

## Overview
Adds a short-lived policy so a test menu PDF that was uploaded during verification
can be deleted. This policy is removed again in the next migration, so it is not a
permanent change to the security model.

## 1. Security
- Adds a DELETE policy on storage.objects for the anon and authenticated roles,
  limited to the `dish-images` bucket and the `menus/` prefix only.
- Read and insert access are unchanged. No other table is touched.
*/

DROP POLICY IF EXISTS "tmp_delete_menu_uploads" ON storage.objects;
CREATE POLICY "tmp_delete_menu_uploads" ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'dish-images' AND name LIKE 'menus/%');
