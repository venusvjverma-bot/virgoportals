/*
# Add per-dish Additional Request to order items

1. Modified Table
- `order_items` gains `additional_request` (text, not null, default empty string).
- Existing order lines are backfilled automatically with the empty default, so
  historical orders keep displaying exactly as before.

2. Constraints
- A CHECK limits the stored text to 500 characters. The word limit (50 words) is
  enforced by the ordering function before insert.

3. Security
- No new table, policy or function. The column is covered by the existing
  table-level privileges and row level security on `order_items`.

4. Notes
- The request is stored only on the dish line it belongs to. The guest-facing
  guidance text is never stored or sent to the restaurant.
*/

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS additional_request text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.order_items'::regclass
      AND conname = 'order_items_additional_request_length'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_additional_request_length
      CHECK (char_length(additional_request) <= 500);
  END IF;
END $$;
