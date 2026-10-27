/*
# Add currency column to restaurants

1. Changes
- Adds `currency` text column to `restaurants` table, NOT NULL, defaulting to 'SEK'.
- Existing restaurants get 'SEK' automatically via the default.
- The `orders` table already has a `currency` column (default 'SEK') — no change needed there.

2. Security
- No RLS or policy changes — the existing restaurant ownership policies already
  cover SELECT and UPDATE on the `restaurants` table, and `currency` is a
  host-editable field like `name` or `city`.
- No new grants needed — the existing grants on `restaurants` cover all columns.
*/

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'SEK';
