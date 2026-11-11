/*
# Add optional business information to restaurants

1. Purpose
- Hosts will supply optional invoicing details (a legal/business name and a
  postal address) that will later be reused for checkout and invoice
  generation. They are stored on the existing host/restaurant record, so no
  separate table is introduced and no new join is needed.

2. New columns on `restaurants`
- `business_name` (text, NULLABLE, no default)
  The registered or trading name of the host's business.
- `business_address` (text, NULLABLE, no default)
  The business postal address, as a single free-text block.
- Both are deliberately nullable and default to NULL, which means every
  existing account keeps working untouched: a missing value simply reads as
  "not provided yet".
- No existing column is renamed, retyped or backfilled. In particular the
  existing `name` and `city` columns (the restaurant's own name and location)
  are NOT modified and are NOT used to populate the new fields.

3. Security
- Row level security on `restaurants` is unchanged. Access is still governed
  by the existing policies:
  - SELECT: the host who owns the row, or an admin.
  - UPDATE: the host who owns the row, or an admin.
- The existing `guard_restaurant_columns` trigger is unchanged; it continues
  to protect `owner_id`, `owner_email` and `status` from host edits. The two
  new columns are ordinary host-editable fields, like `name` and `city`.
- This project grants table access at COLUMN level, so a new column is NOT
  reachable by an existing role until it is granted explicitly. The new
  columns are therefore granted to exactly the roles that need them:
  - `authenticated`: SELECT, INSERT, UPDATE — the Host Dashboard reads and
    saves these fields directly.
  - `service_role`: SELECT, INSERT, UPDATE — the signup endpoint writes them
    when a new host provides them at signup.
  - `anon` is NOT granted: these are private business details and the visitor
    facing app never reads them. The public portal lookup returns only
    name/city/welcome through a separate function, which is unchanged.
- No new function, policy or trigger is created, and no privilege is widened.

4. Important notes
- Values are optional everywhere: signup succeeds with both fields empty, and
  the Host Dashboard can save either field independently.
- Checkout and invoice generation are intentionally NOT changed by this
  migration; it only makes the data available to be read later.
*/

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS business_address text;

GRANT SELECT (business_name, business_address) ON restaurants TO authenticated;
GRANT INSERT (business_name, business_address) ON restaurants TO authenticated;
GRANT UPDATE (business_name, business_address) ON restaurants TO authenticated;

GRANT SELECT (business_name, business_address) ON restaurants TO service_role;
GRANT INSERT (business_name, business_address) ON restaurants TO service_role;
GRANT UPDATE (business_name, business_address) ON restaurants TO service_role;
