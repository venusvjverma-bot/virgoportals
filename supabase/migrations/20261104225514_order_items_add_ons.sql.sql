/*
# Store add-ons on each order line

## Plain-English summary
Add-ons selected in a Food or Drink item's enlarged card are saved on that item's order line, so they stay linked to their parent item.

## Modified tables
- `order_items`
  - `add_ons` (jsonb, NOT NULL, default '[]') - list of the add-ons chosen for this line, each with `dish_id`, `name` and `price_minor` (the add-on's own price at the time of ordering).

## Security
- No new tables, policies or grants. The column inherits the existing order_items grants.

## Important notes
1. Existing rows get an empty list and behave exactly as before.
2. The add-on price is already included in `price_minor`, so order totals do not change formula.
*/

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS add_ons jsonb NOT NULL DEFAULT '[]'::jsonb;
