/*
# Create print_jobs queue for department-based automatic ticket printing

1. New Tables
- `print_jobs`
  - `id` (uuid, primary key) — job identifier.
  - `order_id` (uuid, NOT NULL, unique) — the order to print. The unique
    constraint guarantees at most one print job per order, preventing
    accidental duplicate printing.
  - `department_id` (uuid, NOT NULL, references departments) — identifies which
    department's printer should receive the ticket.
  - `restaurant_id` (uuid, NOT NULL, references restaurants) — used for host
    access checks and agent scoping.
  - `printer` (jsonb, NOT NULL) — snapshot of the department's printer config at
    enqueue time: { name, connection, ip, port, paperWidthMm }.
  - `ticket` (jsonb, NOT NULL) — snapshot of all order/ticket data needed to
    render the 80 mm receipt (order number, items, totals, payment info), so the
    agent does not need to query order tables.
  - `status` (text, NOT NULL, default 'pending') — 'pending' | 'printing' |
    'printed' | 'failed'.
  - `attempts` (integer, NOT NULL, default 0) — delivery attempts so far.
  - `last_error` (text) — last delivery error message, if any.
  - `claimed_at` (timestamptz) — when an agent started delivering this job.
  - `printed_at` (timestamptz) — when the printer accepted the job.
  - `created_at` / `updated_at` (timestamptz).

2. Purpose
- Cloud services enqueue jobs; an always-on print agent running on the
  restaurant's local network polls this table and delivers jobs to the
  department's Wi-Fi/LAN printer over a raw TCP socket (port 9100). This is the
  bridge between the cloud app and the private LAN: the cloud never connects to
  the printer directly — the local agent does, and it requires no Host login.

3. Security
- RLS enabled. No anon access. Hosts (authenticated) can view print jobs for
  their own restaurant (SELECT only) so the Host Portal can display print
  status. The print agent authenticates with the service-role key and the edge
  functions enqueue jobs with the service-role key; both hold full grants.

4. Notes
- Failed jobs never affect the order itself — order data lives in `orders` and
  is untouched by print delivery. Agents retry pending jobs up to a limit and
  record `last_error` for the Host to see.
*/

CREATE TABLE IF NOT EXISTS print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  printer jsonb NOT NULL,
  ticket jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  claimed_at timestamptz,
  printed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT print_jobs_order_id_key UNIQUE (order_id),
  CONSTRAINT print_jobs_status_check CHECK (status IN ('pending', 'printing', 'printed', 'failed'))
);

CREATE INDEX IF NOT EXISTS print_jobs_department_status_idx
  ON print_jobs(department_id, status, created_at);

ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON print_jobs TO authenticated;

DROP POLICY IF EXISTS "hosts_view_own_print_jobs" ON print_jobs;
CREATE POLICY "hosts_view_own_print_jobs" ON print_jobs
  FOR SELECT
  TO authenticated
  USING (public.owns_restaurant(restaurant_id) OR public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON print_jobs TO service_role;
