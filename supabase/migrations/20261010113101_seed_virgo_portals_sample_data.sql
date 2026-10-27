/*
# Virgo Portals — sample portals and usage history

## Overview
Adds the host status flag and seeds the four sample restaurants that the admin
dashboard already displayed, plus a small menu and a history of usage events so
the admin Home and Usage screens show real, database-backed numbers.

## 1. Modified Tables
### `restaurants`
- Adds `status` (text, not null, default 'Active') — either 'Active' or 'Blocked'.
  The admin Hosts screen toggles this value.

## 2. Seed data
- Four sample restaurants (Olive & Thyme, Cedar Lane Kitchen, Saffron House,
  Harbor Table) are inserted once, keyed by `owner_email`. Re-running this
  migration does not duplicate them.
- A few dishes per sample restaurant are inserted only when the `dishes` table is
  empty, so real host data is never touched.
- Usage events (uploads, images, visitor messages) are inserted only when the
  `usage_events` table is empty, so the admin counters have history to show.

## 3. Security
- No policy changes. Row level security from the previous migration still applies.
*/

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active';

DO $$
DECLARE
  r record;
  default_prompt text;
BEGIN
  SELECT value->>'text' INTO default_prompt FROM app_config WHERE key = 'botText';
  IF default_prompt IS NULL THEN
    default_prompt := 'You are the restaurant host''s menu assistant.';
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('hello@oliveandthyme.com', 'Olive & Thyme', 'Portland', 'Active',
       'Welcome to Olive & Thyme! Ask me about anything on our menu, from wood-fired plates to the desserts we bake each morning. I can share ingredients, dietary notes, and what our guests love most.'),
      ('team@cedarlanekitchen.com', 'Cedar Lane Kitchen', 'Austin', 'Active',
       'Hi and welcome to Cedar Lane Kitchen. I am here to walk you through our seasonal menu, highlight today''s specials, and answer questions about ingredients or allergens. What would you like to explore first?'),
      ('front@saffronhouse.com', 'Saffron House', 'Chicago', 'Active',
       'Welcome to Saffron House. I can guide you through our menu of slow-cooked classics and house spice blends. Tell me what you are in the mood for and I will point you to the right dishes.'),
      ('hi@harbortable.com', 'Harbor Table', 'Seattle', 'Blocked',
       'Hello from Harbor Table. I can talk you through our daily catch, small plates, and drinks list, all based on what the kitchen has saved for today. What sounds good?')
    ) AS t(owner_email, name, city, status, welcome)
  LOOP
    INSERT INTO restaurants (owner_email, name, city, status, welcome, system_prompt)
    VALUES (r.owner_email, r.name, r.city, r.status, r.welcome, default_prompt)
    ON CONFLICT (owner_email) DO NOTHING;
  END LOOP;
END $$;

DO $$
DECLARE
  target uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dishes) THEN
    SELECT id INTO target FROM restaurants WHERE owner_email = 'hello@oliveandthyme.com';
    IF target IS NOT NULL THEN
      INSERT INTO dishes (restaurant_id, name, description, ingredients, allergy, price, sort_order) VALUES
        (target, 'Charred Rosemary Chicken', 'Half chicken roasted over the wood fire with rosemary and lemon.', 'Chicken, rosemary, lemon, olive oil, sea salt', 'None', '$24', 0),
        (target, 'Thyme Roasted Carrots', 'Heirloom carrots glazed with honey and fresh thyme.', 'Carrots, honey, thyme, butter', 'Dairy', '$11', 1),
        (target, 'Olive Oil Cake', 'Warm citrus cake baked with our house olive oil.', 'Flour, eggs, olive oil, orange, sugar', 'Gluten, eggs', '$9', 2);
    END IF;

    SELECT id INTO target FROM restaurants WHERE owner_email = 'team@cedarlanekitchen.com';
    IF target IS NOT NULL THEN
      INSERT INTO dishes (restaurant_id, name, description, ingredients, allergy, price, sort_order) VALUES
        (target, 'Cedar Smash Burger', 'Two seared patties, aged cheddar, and house pickles.', 'Beef, cheddar, pickles, brioche bun', 'Gluten, dairy', '$16', 0),
        (target, 'Summer Corn Salad', 'Sweet corn, cherry tomato, basil, and lime.', 'Corn, tomato, basil, lime', 'None', '$12', 1);
    END IF;

    SELECT id INTO target FROM restaurants WHERE owner_email = 'front@saffronhouse.com';
    IF target IS NOT NULL THEN
      INSERT INTO dishes (restaurant_id, name, description, ingredients, allergy, price, sort_order) VALUES
        (target, 'Slow Cooked Lamb Curry', 'Lamb simmered for hours in our house spice blend.', 'Lamb, tomato, onion, garam masala, ginger', 'None', '$27', 0),
        (target, 'Saffron Rice', 'Basmati rice steamed with saffron and cardamom.', 'Basmati rice, saffron, cardamom', 'None', '$7', 1);
    END IF;

    SELECT id INTO target FROM restaurants WHERE owner_email = 'hi@harbortable.com';
    IF target IS NOT NULL THEN
      INSERT INTO dishes (restaurant_id, name, description, ingredients, allergy, price, sort_order) VALUES
        (target, 'Daily Catch', 'The freshest fish from the morning boats, grilled simply.', 'Fish, lemon, olive oil', 'Fish', '$29', 0),
        (target, 'Harbor Chowder', 'Creamy chowder with clams, potato, and thyme.', 'Clams, potato, cream, thyme', 'Shellfish, dairy', '$14', 1);
    END IF;
  END IF;
END $$;

DO $$
DECLARE
  r record;
  cfg record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM usage_events) THEN
    FOR r IN
      SELECT * FROM (VALUES
        ('hello@oliveandthyme.com', 42, 31, 618),
        ('team@cedarlanekitchen.com', 28, 24, 402),
        ('front@saffronhouse.com', 55, 47, 954),
        ('hi@harbortable.com', 19, 12, 187)
      ) AS t(owner_email, uploads, images, messages)
    LOOP
      SELECT id INTO cfg FROM restaurants WHERE owner_email = r.owner_email;
      CONTINUE WHEN cfg IS NULL;

      INSERT INTO usage_events (restaurant_id, kind, created_at)
      SELECT cfg.id, 'upload', now() - (g || ' hours')::interval
      FROM generate_series(1, r.uploads) g;

      INSERT INTO usage_events (restaurant_id, kind, created_at)
      SELECT cfg.id, 'image', now() - (g || ' hours')::interval
      FROM generate_series(1, r.images) g;

      INSERT INTO usage_events (restaurant_id, kind, created_at)
      SELECT cfg.id, 'message', now() - (g || ' minutes')::interval
      FROM generate_series(1, r.messages) g;
    END LOOP;
  END IF;
END $$;
