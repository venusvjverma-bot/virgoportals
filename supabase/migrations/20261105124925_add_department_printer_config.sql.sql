/*
# Add department printer configuration columns

1. Modified Tables
- `departments` — adds five nullable columns that store each department's own
  receipt printer configuration:
  - `printer_enabled` (boolean, default false) — whether a printer is configured for this department.
  - `printer_name` (text) — a human-readable label for the printer, e.g. "Bar printer".
  - `printer_connection` (text) — connection type, either 'wifi' or 'lan'.
  - `printer_ip` (text) — the printer's IP address on the local network.
  - `printer_port` (integer) — network port, typically 9100 for raw TCP printing.
- All columns are nullable so existing departments are unaffected and keep working.

2. Security
- No RLS changes: the existing policies on `departments` already scope SELECT and
  UPDATE to the owning restaurant's host (or an admin), so printer settings are
  automatically protected by the same rules. No new grants are needed — UPDATE on
  the table is already granted to `authenticated`.

3. Notes
- Paper width is fixed at 80 mm and is not stored per department; it is a constant
  of the shared ticket template.
- This phase stores configuration only. No print jobs are sent in this phase.
*/

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS printer_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS printer_name text,
  ADD COLUMN IF NOT EXISTS printer_connection text,
  ADD COLUMN IF NOT EXISTS printer_ip text,
  ADD COLUMN IF NOT EXISTS printer_port integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'departments_printer_connection_check'
  ) THEN
    ALTER TABLE departments
      ADD CONSTRAINT departments_printer_connection_check
      CHECK (printer_connection IN ('wifi', 'lan'));
  END IF;
END $$;
