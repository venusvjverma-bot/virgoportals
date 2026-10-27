/*
# Enforce one restaurant per host account

1. Purpose
- Public host signup now lets a restaurant owner create their own account and
  their own restaurant record. Before this change nothing stopped a single
  account from being linked to more than one restaurant row.
- The host area resolves "my restaurant" by looking for exactly one row owned by
  the signed-in account. A second owned row would make that lookup ambiguous and
  break the host area, so the database should refuse it outright.

2. Changes
- New partial unique index `restaurants_owner_id_unique` on
  `restaurants(owner_id)`, restricted to rows where `owner_id IS NOT NULL`.
- No tables, columns, or data are removed or altered.

3. Why a PARTIAL index
- The four original unowned demonstration rows keep `owner_id = NULL`. A partial
  index ignores NULL entries entirely, so those rows are untouched and any number
  of unowned rows may still exist. Only real ownership is constrained.

4. Security
- No policy changes. Row level security already stops a host from reading or
  changing anyone else's restaurant. This index is an additional data-integrity
  guard that backs that up at the storage layer: one account can never end up
  owning two restaurants, even if two signups race each other.

5. Notes
- Safe to re-run: `CREATE UNIQUE INDEX IF NOT EXISTS` does nothing when the index
  already exists.
- Checked before applying that no account currently owns more than one row, so
  the index builds without conflict.
*/

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_owner_id_unique
  ON public.restaurants (owner_id)
  WHERE owner_id IS NOT NULL;
