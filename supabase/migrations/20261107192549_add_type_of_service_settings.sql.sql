/*
# Add Type of Service settings to departments and events

1. Overview
   Adds a "Type of Service" configuration for Host Portal departments and
   events. Hosts can enable Table Service and/or Room Service for each
   department and each event independently, with an optional additional
   charge (in minor units, i.e. cents/ören) for each enabled service.

2. Modified Tables
   - `departments`: new columns
     - `table_service_enabled` (boolean, NOT NULL, default false)
     - `table_service_charge` (integer, NOT NULL, default 0, minor units)
     - `room_service_enabled` (boolean, NOT NULL, default false)
     - `room_service_charge` (integer, NOT NULL, default 0, minor units)
   - `events`: the same four new columns with the same defaults.

3. Security
   - No RLS changes. Both tables already have RLS enabled with
     owner-scoped (owns_restaurant) CRUD policies for authenticated users,
     and full column grants for `authenticated`. The new columns are
     automatically covered by those existing grants and policies, so only
     the rightful restaurant owner can read or change these settings.
   - CHECK constraints reject negative charges at the database level.

4. Notes
   - Charges are stored as integers in minor units, consistent with how
     all other monetary values in this schema are stored.
   - Defaults (all disabled, zero charge) mean existing rows and new
     departments/events behave exactly as before until a Host opts in.
*/

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS table_service_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS table_service_charge integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS room_service_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS room_service_charge integer NOT NULL DEFAULT 0;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS table_service_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS table_service_charge integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS room_service_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS room_service_charge integer NOT NULL DEFAULT 0;

ALTER TABLE departments
  ADD CONSTRAINT departments_table_service_charge_non_negative CHECK (table_service_charge >= 0),
  ADD CONSTRAINT departments_room_service_charge_non_negative CHECK (room_service_charge >= 0);

ALTER TABLE events
  ADD CONSTRAINT events_table_service_charge_non_negative CHECK (table_service_charge >= 0),
  ADD CONSTRAINT events_room_service_charge_non_negative CHECK (room_service_charge >= 0);
