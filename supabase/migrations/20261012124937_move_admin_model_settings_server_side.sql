/*
# Admin model settings server-side + admin session authorization

## Overview
Prepares the backend so the Admin "Chat model" and "Image model" pages can run
real provider tests without ever exposing API keys to the browser, and so that
hosts and visitors cannot read or change those settings.

## 1. New Tables

### `model_settings` (private)
Holds the chat and image model configuration, including the API key.
- `key` (text, primary key) — `chatModel` or `imageModel`.
- `provider` (text) — provider label, e.g. `OpenAI`.
- `api_key` (text) — the secret key. Never returned to the browser.
- `model` (text) — model name.
- `endpoint` (text) — full request URL.
- `updated_at` (timestamptz)

### `admin_credentials` (private)
The server-side admin login used to authorize admin model operations.
- `email` (text, primary key)
- `password` (text)
- `updated_at` (timestamptz)

### `admin_sessions` (private)
Short-lived tokens issued after a successful admin login, sent by the admin
dashboard when it reads, saves, or tests model settings.
- `token` (text, primary key)
- `email` (text)
- `created_at`, `expires_at` (timestamptz)

## 2. Security
- Row level security is enabled on all three tables.
- `REVOKE ALL ... FROM anon, authenticated` removes Data API access entirely, and
  with no policies defined the tables are deny-by-default for those roles. Only the
  service role (used by the edge functions) can read or write them. This is the
  change that keeps API keys off the client.
- `GRANT ALL ... TO service_role` makes sure the edge functions keep working.

## 3. Data migration
- Copies the existing `chatModel` and `imageModel` values out of `app_config`
  (which the browser could read) into `model_settings`.
- Seeds default rows when nothing existed yet.
- Deletes the two secret-bearing rows from `app_config` after the copy, so the
  browser-readable table no longer contains any API key. `app_config` keeps the
  `botText` row, which hosts still read.

## 4. Notes
- No other tables or policies are changed.
*/

CREATE TABLE IF NOT EXISTS model_settings (
  key text PRIMARY KEY,
  provider text NOT NULL DEFAULT '',
  api_key text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  endpoint text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_credentials (
  email text PRIMARY KEY,
  password text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token text PRIMARY KEY,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx ON admin_sessions (expires_at);

ALTER TABLE model_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON model_settings FROM anon, authenticated;
REVOKE ALL ON admin_credentials FROM anon, authenticated;
REVOKE ALL ON admin_sessions FROM anon, authenticated;

GRANT ALL ON model_settings TO service_role;
GRANT ALL ON admin_credentials TO service_role;
GRANT ALL ON admin_sessions TO service_role;

INSERT INTO admin_credentials (email, password)
VALUES ('venusvjverma@gmail.com', 'virgo-admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO model_settings (key, provider, api_key, model, endpoint)
SELECT
  'chatModel',
  COALESCE(value->>'provider', ''),
  COALESCE(value->>'apiKey', ''),
  COALESCE(value->>'model', ''),
  COALESCE(value->>'endpoint', '')
FROM app_config
WHERE key = 'chatModel'
ON CONFLICT (key) DO NOTHING;

INSERT INTO model_settings (key, provider, api_key, model, endpoint)
SELECT
  'imageModel',
  COALESCE(value->>'provider', ''),
  COALESCE(value->>'apiKey', ''),
  COALESCE(value->>'model', ''),
  COALESCE(value->>'endpoint', '')
FROM app_config
WHERE key = 'imageModel'
ON CONFLICT (key) DO NOTHING;

INSERT INTO model_settings (key, provider, model, endpoint) VALUES
  ('chatModel', 'OpenAI', 'gpt-4o-mini', 'https://api.openai.com/v1/chat/completions'),
  ('imageModel', 'OpenAI', 'dall-e-3', 'https://api.openai.com/v1/images/generations')
ON CONFLICT (key) DO NOTHING;

DELETE FROM app_config WHERE key IN ('chatModel', 'imageModel');
