/*
# Add Add-on as an independent menu section

1. What changes
- Dishes can now belong to a third top-level section, "add_on", alongside "food" and "drinks".
- A matching category "add_ons" is allowed so Add-on items use the same dish record as everything else.

2. Modified tables
- dishes: section and category CHECK constraints are replaced with versions that include the new values. No existing rows are changed.

3. Security
- No RLS, policy or grant changes. Existing access rules apply unchanged.

4. Notes
- Existing Food and Drinks rows keep their values.
- Dropping and re-adding a CHECK constraint is safe here because the new lists are strict supersets of the old ones.
*/

ALTER TABLE dishes DROP CONSTRAINT IF EXISTS dishes_section_valid;
ALTER TABLE dishes ADD CONSTRAINT dishes_section_valid
  CHECK (section IN ('food', 'drinks', 'add_on'));

ALTER TABLE dishes DROP CONSTRAINT IF EXISTS dishes_category_valid;
ALTER TABLE dishes ADD CONSTRAINT dishes_category_valid
  CHECK (category IN (
    'starters_appetizers', 'main_courses', 'soups', 'salads', 'sides',
    'desserts', 'kids_menu', 'specials',
    'coffee_tea', 'soft_drinks_water', 'juices', 'mocktails',
    'cocktails', 'beer_cider', 'wine', 'spirits_shots', 'non_alcoholic_beer',
    'add_ons'
  ));
