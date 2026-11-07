/*
# Add closed Department session report print jobs

1. Modified Table
- `print_jobs`
  - `job_type` identifies the existing `order` ticket jobs separately from new `session_report` jobs.
  - `session_id` links a report job to its closed Department session.
  - `order_id` becomes nullable for report jobs while existing order jobs remain protected by a partial unique index.
  - A consistency check requires order jobs to reference an order and report jobs to reference a session.

2. New Function
- `enqueue_department_session_report(uuid)` validates that the signed-in Host owns the session's restaurant, confirms the session is closed, snapshots the Department printer configuration, and builds the report payload from stored session orders.

3. Security
- Existing Host SELECT access to `print_jobs` remains unchanged.
- The enqueue function is security-definer with a pinned search path and is callable only by authenticated users.
- Anonymous users cannot enqueue report jobs.

4. Compatibility
- Existing order print jobs retain their current shape, status lifecycle, and one-job-per-order protection.
- No existing order rows or print jobs are modified.
*/

ALTER TABLE public.print_jobs
  ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE public.print_jobs
  ADD COLUMN IF NOT EXISTS job_type text NOT NULL DEFAULT 'order',
  ADD COLUMN IF NOT EXISTS session_id uuid NULL REFERENCES public.department_sessions(id) ON DELETE RESTRICT;

ALTER TABLE public.print_jobs
  DROP CONSTRAINT IF EXISTS print_jobs_order_id_key;

ALTER TABLE public.print_jobs
  DROP CONSTRAINT IF EXISTS print_jobs_job_type_check;

ALTER TABLE public.print_jobs
  ADD CONSTRAINT print_jobs_job_type_check CHECK (
    (job_type = 'order' AND order_id IS NOT NULL AND session_id IS NULL)
    OR (job_type = 'session_report' AND order_id IS NULL AND session_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS print_jobs_one_order_idx
  ON public.print_jobs(order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS print_jobs_session_id_idx
  ON public.print_jobs(session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enqueue_department_session_report(p_session_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session record;
  v_orders jsonb;
  v_payment_totals jsonb;
  v_total_minor integer;
  v_order_count integer;
  v_duration_minutes integer;
  v_job_id uuid;
BEGIN
  SELECT
    s.id,
    s.department_id,
    s.started_at,
    s.closed_at,
    d.name AS department_name,
    d.printer_enabled,
    d.printer_name,
    d.printer_connection,
    d.printer_ip,
    d.printer_port,
    r.id AS restaurant_id,
    r.name AS restaurant_name,
    r.currency
  INTO v_session
  FROM public.department_sessions s
  JOIN public.departments d ON d.id = s.department_id
  JOIN public.restaurants r ON r.id = d.restaurant_id
  WHERE s.id = p_session_id
    AND s.closed_at IS NOT NULL
    AND (public.owns_restaurant(r.id) OR public.is_admin());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Closed session not found or not authorized';
  END IF;

  IF NOT v_session.printer_enabled OR v_session.printer_ip IS NULL THEN
    RAISE EXCEPTION 'No printer is configured for this Department';
  END IF;

  SELECT
    count(*)::integer,
    coalesce(sum(o.total_minor), 0)::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'orderNumber', o.order_number,
          'paymentType', CASE WHEN o.payment_status = 'pay_to_staff' THEN 'Staff Payment' ELSE 'Online Payment' END,
          'amountMinor', o.total_minor,
          'currency', o.currency
        ) ORDER BY o.created_at
      ),
      '[]'::jsonb
    )
  INTO v_order_count, v_total_minor, v_orders
  FROM public.orders o
  WHERE o.session_id = p_session_id;

  SELECT coalesce(jsonb_object_agg(payment_type, amount_minor), '{}'::jsonb)
  INTO v_payment_totals
  FROM (
    SELECT
      CASE WHEN o.payment_status = 'pay_to_staff' THEN 'Staff Payment' ELSE 'Online Payment' END AS payment_type,
      sum(o.total_minor)::integer AS amount_minor
    FROM public.orders o
    WHERE o.session_id = p_session_id
    GROUP BY 1
  ) payment_groups;

  v_duration_minutes := greatest(0, floor(extract(epoch FROM (v_session.closed_at - v_session.started_at)) / 60)::integer);

  INSERT INTO public.print_jobs (
    order_id,
    session_id,
    job_type,
    department_id,
    restaurant_id,
    printer,
    ticket
  )
  VALUES (
    NULL,
    p_session_id,
    'session_report',
    v_session.department_id,
    v_session.restaurant_id,
    jsonb_build_object(
      'name', coalesce(v_session.printer_name, 'Printer'),
      'connection', coalesce(v_session.printer_connection, 'lan'),
      'ip', v_session.printer_ip,
      'port', coalesce(v_session.printer_port, 9100),
      'paperWidthMm', 80
    ),
    jsonb_build_object(
      'reportType', 'session_report',
      'restaurantName', v_session.restaurant_name,
      'departmentName', v_session.department_name,
      'startedAt', v_session.started_at,
      'closedAt', v_session.closed_at,
      'durationMinutes', v_duration_minutes,
      'orderCount', v_order_count,
      'totalMinor', v_total_minor,
      'currency', v_session.currency,
      'paymentTotals', v_payment_totals,
      'orders', v_orders
    )
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_department_session_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_department_session_report(uuid) TO authenticated;
