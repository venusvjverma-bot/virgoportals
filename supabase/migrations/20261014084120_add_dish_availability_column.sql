/*
# Add availability column to dishes table

1. New Columns
- `dishes.available` (boolean, NOT NULL, DEFAULT true) — controls whether a
  dish/drink is included in the LLM's menu context for the visitor chat.
  true = "Available" (included), false = "Sold Out" (excluded completely).
  All existing rows default to true so no current item disappears from the
  menu. New inserts that omit the column also get true.

2. Modified Tables
- `dishes` — one column added; no columns removed or renamed.

3. Security
- No RLS policy changes. Existing dish-level RLS policies (owner-scoped
  CRUD for authenticated hosts, public read for visitors) already cover the
  new column because column-level privileges are not in use — the policies
  operate at the row level and the new column is readable/writable by the
  same roles.

4. Important Notes
- The column is added inside a DO $$ ... END $$ block with an IF NOT EXISTS
  check so the migration is safe to re-run.
- No data is lost: the DEFAULT true backfills every existing row.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dishes' AND column_name = 'available'
  ) THEN
    ALTER TABLE dishes ADD COLUMN available boolean NOT NULL DEFAULT true;
  END IF;
END $$;
