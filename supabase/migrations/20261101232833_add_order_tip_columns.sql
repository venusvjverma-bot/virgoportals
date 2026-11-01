/*
# Add tip fields to orders

## Plain-English summary
Visitors can now optionally add a tip at checkout. The food subtotal and the
tip are stored separately so the Host can see both. The existing total is
now the food subtotal plus the tip.

## New columns on `orders`
- `subtotal_minor` (integer, default 0): food total before tip, in minor units.
- `tip_option` (text, default 'none'): one of 'none', '5', '10', '13', '20', 'custom'.
- `tip_minor` (integer, default 0): tip amount in minor units, never negative.

## Modified columns
- `total_minor` keeps its meaning as the amount the guest pays. From now on it
  equals `subtotal_minor + tip_minor`.

## Backfill
- Existing orders had no tip, so `subtotal_minor` is set to `total_minor`.
  Only rows still at the default are changed, so re-running is safe.

## Security
- No new tables and no policy changes. The existing host read policy already
  covers new columns on `orders`.
- Order writes still go through the server-side order function.

## Notes
- Statements are idempotent and safe to re-run.
- No data is removed or renamed.
*/

ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_minor integer NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tip_option text NOT NULL DEFAULT 'none';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tip_minor integer NOT NULL DEFAULT 0;

UPDATE orders
SET subtotal_minor = total_minor
WHERE subtotal_minor = 0 AND tip_minor = 0 AND total_minor <> 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_tip_option_check'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_tip_option_check
      CHECK (tip_option IN ('none', '5', '10', '13', '20', 'custom'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_tip_minor_check'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_tip_minor_check
      CHECK (tip_minor >= 0);
  END IF;
END $$;
