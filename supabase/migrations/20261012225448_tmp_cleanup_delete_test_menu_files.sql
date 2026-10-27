/*
# Temporary cleanup policy for test menu files

1. Purpose
- Three throwaway PDFs were uploaded while testing the menu reader
  (drinks-test.pdf, scanned-test.pdf, broken-test.pdf). They are orphaned
  objects and should not be left in the host's storage bucket.
- The dish-images bucket deliberately has no DELETE policy, so the Storage API
  refuses to remove them. This migration temporarily allows deletion, the files
  are removed, and the very next migration revokes it again.

2. Security
- This grant is intentionally short-lived and is reverted immediately by
  migration `revoke_tmp_cleanup_menu_upload_policy`.
- It is scoped to the dish-images bucket only and grants nothing else.
- It is added and removed in the same session so the final security posture is
  identical to the state before this pair of migrations.
*/

CREATE POLICY "tmp_cleanup_delete_dish_images" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'dish-images');
