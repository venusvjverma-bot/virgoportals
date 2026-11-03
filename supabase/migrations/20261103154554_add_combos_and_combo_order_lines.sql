/*
# Add Combo products and combo order lines

## What this changes
Adds a separate Combo product type that is managed apart from ordinary dishes. A Combo has a fixed price and one or more selection groups. Each group asks the visitor to choose a set number of dishes from one menu section and category. Combo order lines are stored as a single order item with a snapshot of every chosen dish.

## New tables
1. combos: one row per Combo product. Scoped to a restaurant and optionally to one department or one event, the same way dishes are.
2. combo_groups: one row per selection group. Stores the menu section, the menu category, and the required selection count (0 means optional).

## Changed tables
1. order_items
   - dish_id becomes nullable. A combo line has no single dish.
   - combo_id (nullable, references combos) identifies a combo line.
   - selections (jsonb) holds the snapshot of chosen dishes, serving options, removals and upgrade charges.
   - A check ensures each row is either a dish line (dish_id set, combo_id null) or a combo line (combo_id set, dish_id null).
   - Existing rows are unaffected: they all have a dish_id and no combo_id.

## Security
1. Row level security is enabled on combos and combo_groups.
2. Restaurant owners (and admins) can select, insert, update and delete their own combos and groups, using the same owns_restaurant rule as dishes.
3. Visitors have no direct table access. Visitor reads and order writes go through the existing server functions with the service role, which is how dishes are read today.
4. A trigger checks that a combo's department or event belongs to the same restaurant.
5. Grants are limited to the verbs each role uses.

## Notes
1. Historical order lines keep their own snapshot (name, prices, selections). They do not depend on the live combo or dish rows.
2. Deleting a combo sets combo_id to null on existing order lines. The snapshot still shows the combo name.
3. No columns are dropped, renamed or retyped.
*/

CREATE TABLE IF NOT EXISTS combos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  department_id uuid NULL REFERENCES departments(id) ON DELETE CASCADE,
  event_id uuid NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  description text NOT NULL DEFAULT '',
  image_url text NULL,
  price text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT combos_single_scope CHECK (department_id IS NULL OR event_id IS NULL)
);

CREATE INDEX IF NOT EXISTS combos_restaurant_id_idx ON combos (restaurant_id);
CREATE INDEX IF NOT EXISTS combos_department_id_idx ON combos (department_id);
CREATE INDEX IF NOT EXISTS combos_event_id_idx ON combos (event_id);

CREATE TABLE IF NOT EXISTS combo_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id uuid NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  section text NOT NULL,
  category text NOT NULL,
  required_count integer NOT NULL CHECK (required_count >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS combo_groups_combo_id_idx ON combo_groups (combo_id);

CREATE OR REPLACE FUNCTION combos_validate_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.department_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM departments d WHERE d.id = NEW.department_id AND d.restaurant_id = NEW.restaurant_id
    ) THEN
      RAISE EXCEPTION 'Department does not belong to this restaurant';
    END IF;
  END IF;
  IF NEW.event_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM events e WHERE e.id = NEW.event_id AND e.restaurant_id = NEW.restaurant_id
    ) THEN
      RAISE EXCEPTION 'Event does not belong to this restaurant';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION combos_validate_scope() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS combos_validate_scope_trg ON combos;
CREATE TRIGGER combos_validate_scope_trg
  BEFORE INSERT OR UPDATE OF restaurant_id, department_id, event_id ON combos
  FOR EACH ROW EXECUTE FUNCTION combos_validate_scope();

ALTER TABLE combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_groups ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON combos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON combo_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON combos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON combo_groups TO service_role;

DROP POLICY IF EXISTS "host_select_own_combos" ON combos;
CREATE POLICY "host_select_own_combos" ON combos FOR SELECT
  TO authenticated USING (owns_restaurant(restaurant_id) OR is_admin());

DROP POLICY IF EXISTS "host_insert_own_combos" ON combos;
CREATE POLICY "host_insert_own_combos" ON combos FOR INSERT
  TO authenticated WITH CHECK (owns_restaurant(restaurant_id) OR is_admin());

DROP POLICY IF EXISTS "host_update_own_combos" ON combos;
CREATE POLICY "host_update_own_combos" ON combos FOR UPDATE
  TO authenticated USING (owns_restaurant(restaurant_id) OR is_admin())
  WITH CHECK (owns_restaurant(restaurant_id) OR is_admin());

DROP POLICY IF EXISTS "host_delete_own_combos" ON combos;
CREATE POLICY "host_delete_own_combos" ON combos FOR DELETE
  TO authenticated USING (owns_restaurant(restaurant_id) OR is_admin());

DROP POLICY IF EXISTS "host_select_own_combo_groups" ON combo_groups;
CREATE POLICY "host_select_own_combo_groups" ON combo_groups FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM combos c WHERE c.id = combo_groups.combo_id
      AND (owns_restaurant(c.restaurant_id) OR is_admin())
  ));

DROP POLICY IF EXISTS "host_insert_own_combo_groups" ON combo_groups;
CREATE POLICY "host_insert_own_combo_groups" ON combo_groups FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM combos c WHERE c.id = combo_groups.combo_id
      AND (owns_restaurant(c.restaurant_id) OR is_admin())
  ));

DROP POLICY IF EXISTS "host_update_own_combo_groups" ON combo_groups;
CREATE POLICY "host_update_own_combo_groups" ON combo_groups FOR UPDATE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM combos c WHERE c.id = combo_groups.combo_id
      AND (owns_restaurant(c.restaurant_id) OR is_admin())
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM combos c WHERE c.id = combo_groups.combo_id
      AND (owns_restaurant(c.restaurant_id) OR is_admin())
  ));

DROP POLICY IF EXISTS "host_delete_own_combo_groups" ON combo_groups;
CREATE POLICY "host_delete_own_combo_groups" ON combo_groups FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM combos c WHERE c.id = combo_groups.combo_id
      AND (owns_restaurant(c.restaurant_id) OR is_admin())
  ));

ALTER TABLE order_items ALTER COLUMN dish_id DROP NOT NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS combo_id uuid NULL REFERENCES combos(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS selections jsonb NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_dish_or_combo') THEN
    ALTER TABLE order_items ADD CONSTRAINT order_items_dish_or_combo
      CHECK ((dish_id IS NULL) = (combo_id IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_selections_is_array') THEN
    ALTER TABLE order_items ADD CONSTRAINT order_items_selections_is_array
      CHECK (selections IS NULL OR jsonb_typeof(selections) = 'array');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS order_items_combo_id_idx ON order_items (combo_id);
