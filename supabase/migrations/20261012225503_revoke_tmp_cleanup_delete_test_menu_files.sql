/*
# Revoke the temporary cleanup policy

The previous migration added `tmp_cleanup_delete_dish_images` so the test menu
files could be removed. The files are gone, so the policy is dropped here to
restore the original security posture: the dish-images bucket again has no
DELETE policy, and the browser cannot delete stored files.

No other change is made.
*/

DROP POLICY IF EXISTS "tmp_cleanup_delete_dish_images" ON storage.objects;
