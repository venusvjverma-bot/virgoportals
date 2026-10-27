/*
# Add Section + Category structure to dishes

1. Purpose
- Replace the flat 7-value `category` system with a two-level hierarchy:
  Section (food / drinks) + Category (17 sub-categories within a section).
- Every dish gets a persistent `section` column.
- Existing drink categories are mapped to the new Drinks sub-categories.
- All existing food dishes are mapped to Food / Main Courses (host can
  re-categorize individually through the host UI).
- Availability (`available` column) is completely independent and untouched.

2. Schema changes
- `dishes.section` — text NOT NULL DEFAULT 'food'
  Two allowed values: 'food', 'drinks'.
- `dishes.category` — CHECK constraint replaced with 17 new values.
- `dishes.section` — CHECK constraint added for 'food', 'drinks'.

3. Data migration (order matters — constraint dropped first)
- Drop `dishes_category_valid` CHECK before renaming category values.
- Set section='drinks' for rows where category IN drink categories.
- Rename category values:
    cocktail → cocktails
    beer → beer_cider
    wine → wine
    spirit → spirits_shots
    non_alcoholic_drink → non_alcoholic_beer
    food → main_courses
    other → main_courses (fallback, though no 'other' rows currently exist)
- Re-add CHECK constraints for both section and category.
- Backfill any NULL/empty section to 'food' and NULL/empty category to
  'main_courses' as a safety net.

4. Security
- No RLS policy changes. Existing policies on `dishes` are row-level
  (owns_restaurant / is_admin) and are unaffected by new columns.
- No grants or roles changed.

5. Backwards compatibility
- The migration renames category VALUES (not columns), which is
  irreversible without a second migration. Since frontend and edge
  functions deploy in the same batch, no backward-compat window needed.
- No columns dropped, renamed, or retyped. All existing data preserved:
  id, name, price, description, ingredients, allergy, image_url,
  serving, abv, available, sort_order, restaurant_id, created_at, updated_at.

6. Idempotency
- All statements use IF EXISTS / IF NOT EXISTS or are safe to re-run.
  The migration can be applied again without error.
*/

-- Step 1: Add section column
ALTER TABLE dishes
  ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'food';

-- Step 2: Drop the old category CHECK so we can rename values
ALTER TABLE dishes DROP CONSTRAINT IF EXISTS dishes_category_valid;

-- Step 3: Backfill section based on current category
UPDATE dishes SET section = 'drinks'
  WHERE category IN ('cocktail', 'beer', 'wine', 'spirit', 'non_alcoholic_drink');

-- Step 4: Rename category values to the new taxonomy
UPDATE dishes SET category = 'cocktails'         WHERE category = 'cocktail';
UPDATE dishes SET category = 'beer_cider'        WHERE category = 'beer';
UPDATE dishes SET category = 'spirits_shots'      WHERE category = 'spirit';
UPDATE dishes SET category = 'non_alcoholic_beer' WHERE category = 'non_alcoholic_drink';
UPDATE dishes SET category = 'main_courses'       WHERE category = 'food';
UPDATE dishes SET category = 'main_courses'       WHERE category = 'other';

-- 'wine' stays 'wine' (same value in old and new taxonomy)

-- Step 5: Safety net for any edge-case rows
UPDATE dishes SET section = 'food' WHERE section = '' OR section IS NULL;
UPDATE dishes SET category = 'main_courses' WHERE category = '' OR category IS NULL;

-- Step 6: Add new CHECK constraints
ALTER TABLE dishes DROP CONSTRAINT IF EXISTS dishes_section_valid;
ALTER TABLE dishes ADD CONSTRAINT dishes_section_valid
  CHECK (section IN ('food', 'drinks'));

ALTER TABLE dishes DROP CONSTRAINT IF EXISTS dishes_category_valid;
ALTER TABLE dishes ADD CONSTRAINT dishes_category_valid
  CHECK (category IN (
    'starters_appetizers', 'main_courses', 'soups', 'salads', 'sides',
    'desserts', 'kids_menu', 'specials',
    'coffee_tea', 'soft_drinks_water', 'juices', 'mocktails',
    'cocktails', 'beer_cider', 'wine', 'spirits_shots', 'non_alcoholic_beer'
  ));
