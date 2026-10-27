/*
# Add generation settings to model_settings

1. Purpose
- The Admin "Chat model" page needs to store and edit three generation
  settings alongside the existing provider / model / endpoint / key:
  reasoning on/off, temperature, and maximum output tokens.
- Previously these were hard-coded inside the edge functions, so the Admin
  had no way to change them and the reasoning switch could not exist at all.

2. Modified tables
- `model_settings`
  - `reasoning_enabled` (boolean, not null, default false)
      Whether the provider's reasoning / thinking mode is switched on.
      Defaults to false because real tests against the configured Venice
      model showed that reasoning added roughly 15-30 seconds per visitor
      reply while producing the same menu answer.
  - `temperature` (numeric(3,2), not null, default 0.80)
      Sampling temperature sent with every chat request. Allowed 0.00-2.00.
  - `max_output_tokens` (integer, not null, default 1500)
      Cap on generated tokens, sent as max_completion_tokens / max_tokens
      depending on the provider. Allowed 1-100000.

3. Backwards compatibility
- All three columns are added with IF NOT EXISTS and carry defaults, so the
  existing `chatModel` and `imageModel` rows keep working and are not
  overwritten. No existing column is renamed, retyped or dropped.

4. Security
- No policy or grant changes. `model_settings` stays deny-by-default: all
  privileges remain revoked from the `anon` and `authenticated` roles, and
  only the server (service_role) can read or write it. The API key column is
  therefore still unreachable from the browser.
- Check constraints guard the numeric ranges so a bad value cannot be stored
  even if a caller bypasses the edge function validation.

5. Notes
- The constraints are dropped before being re-created so this migration is
  safe to run more than once.
*/

ALTER TABLE model_settings
  ADD COLUMN IF NOT EXISTS reasoning_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS temperature numeric(3,2) NOT NULL DEFAULT 0.80,
  ADD COLUMN IF NOT EXISTS max_output_tokens integer NOT NULL DEFAULT 1500;

ALTER TABLE model_settings DROP CONSTRAINT IF EXISTS model_settings_temperature_range;
ALTER TABLE model_settings
  ADD CONSTRAINT model_settings_temperature_range
  CHECK (temperature >= 0 AND temperature <= 2);

ALTER TABLE model_settings DROP CONSTRAINT IF EXISTS model_settings_max_output_tokens_range;
ALTER TABLE model_settings
  ADD CONSTRAINT model_settings_max_output_tokens_range
  CHECK (max_output_tokens >= 1 AND max_output_tokens <= 100000);
