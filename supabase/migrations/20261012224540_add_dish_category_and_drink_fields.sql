/*
# Add menu category and drink detail fields to dishes

1. Purpose
- The menu reader treated every extracted row as a food dish. Menus that also
  list cocktails, beer, wine, spirits and soft drinks were stored as if they
  were food, so the visitor assistant could not answer "what cocktails do you
  have?" or "do you serve beer?".
- Drinks also carry two details food does not: a serving size / volume and,
  when the document states it, an alcohol percentage.

2. Modified table
- `dishes`
  - `category` (text, not null, default 'food')
      One of: food, cocktail, beer, wine, spirit, non_alcoholic_drink, other.
      The default keeps every existing row classified as food.
  - `serving` (text, not null, default '')
      Serving size or volume as printed, e.g. "40 cl". Empty when not stated.
  - `abv` (text, not null, default '')
      Alcohol percentage as printed, e.g. "5.0%". Empty when not stated.

3. Backwards compatibility
- All three columns are added with IF NOT EXISTS and carry non-null defaults,
  so existing dish rows keep working unchanged and read back as food with no
  serving or ABV. No existing column is renamed, retyped or dropped, so saved
  dishes, dish editing and image generation are unaffected.
- The check constraint is dropped before being re-created so this migration is
  safe to run more than once.

4. Security
- No policy or grant changes. `dishes` keeps its existing row level security
  and its existing anon/authenticated access for this portal-based app. The
  new columns inherit the table's existing privileges and are not sensitive.
- No new secrets or server-only data are introduced.

5. Notes
- `category` is inferred by the menu reader from the document content, not
  from a section heading alone. When the reader is unsure it stores 'other'
  rather than guessing.
*/

ALTER TABLE dishes
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'food',
  ADD COLUMN IF NOT EXISTS serving text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abv text NOT NULL DEFAULT '';

ALTER TABLE dishes DROP CONSTRAINT IF EXISTS dishes_category_valid;
ALTER TABLE dishes
  ADD CONSTRAINT dishes_category_valid
  CHECK (category IN (
    'food',
    'cocktail',
    'beer',
    'wine',
    'spirit',
    'non_alcoholic_drink',
    'other'
  ));
