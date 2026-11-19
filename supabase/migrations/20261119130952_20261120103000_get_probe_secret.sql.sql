CREATE OR REPLACE FUNCTION public.get_probe_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $$
SELECT decrypted_secret FROM vault.decrypted_secrets
WHERE name = 'probe_secret'
LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_probe_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_probe_secret() TO service_role;
