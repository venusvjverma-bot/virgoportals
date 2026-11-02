/*
# Allow the Pay to Staff payment status on orders

1. Modified Tables
- `orders`: the `payment_status` check constraint now accepts `pay_to_staff` in addition to the existing `test_unpaid`.

2. What stays the same
- Existing orders keep `test_unpaid` and are not modified.
- No columns, tables, policies or grants are changed.

3. Notes
- The constraint is dropped with IF EXISTS and re-added in the same migration, so re-running is safe.
- Pay Online orders continue to be stored as `test_unpaid`.
*/

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('test_unpaid', 'pay_to_staff'));
