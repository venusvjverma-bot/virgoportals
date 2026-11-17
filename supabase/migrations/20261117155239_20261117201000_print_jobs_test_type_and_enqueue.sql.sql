/*
# Add 'test' print job type and secure host enqueue function

1. Plain-English summary
The department Printer tab gets a "Send test print" button. It creates a small
test ticket job in the existing print queue; whichever printing app is signed in
for that restaurant (and serving that department) picks it up and prints it on
the department's configured receipt printer. The job type is 'test' so normal
order tickets and session reports are never confused with it. Hosts can only
enqueue tests for departments in their own restaurant.

2. Modified Tables
- `print_jobs`
  - `print_jobs_job_type_check` constraint is replaced: existing
    'order' and 'session_report' rules are unchanged; a new
    `job_type = 'test'` case requires `order_id IS NULL AND session_id IS NULL`
    and stores the department id only.
  - No existing rows are modified; new columns are not added.

3. New Function
- `enqueue_department_test_print(uuid)` — given a department id, verifies the
  signed-in Host owns that department's restaurant (or is admin), verifies the
  department has an enabled printer with an IP, snapshots the printer config,
  and inserts a `test` job into `print_jobs`. Returns the new job id.

4. Security
- Existing Host SELECT access to `print_jobs` unchanged.
- The enqueue function is SECURITY DEFINER with a pinned search_path,
  EXECUTE revoked from PUBLIC and anon, granted to authenticated only.
*/

ALTER TABLE public.print_jobs
  DROP CONSTRAINT IF EXISTS print_jobs_job_type_check;

ALTER TABLE public.print_jobs
  ADD CONSTRAINT print_jobs_job_type_check CHECK (
    (job_type = 'order' AND order_id IS NOT NULL AND session_id IS NULL)
    OR (job_type = 'session_report' AND order_id IS NULL AND session_id IS NOT NULL)
    OR (job_type = 'test' AND order_id IS NULL AND session_id IS NULL AND department_id IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.enqueue_department_test_print(p_department_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_department record;
  v_job_id uuid;
BEGIN
  SELECT
    d.id,
    d.restaurant_id,
    d.name AS department_name,
    d.printer_enabled,
    d.printer_name,
    d.printer_connection,
    d.printer_ip,
    d.printer_port
  INTO v_department
  FROM public.departments d
  WHERE d.id = p_department_id
    AND (public.owns_restaurant(d.restaurant_id) OR public.is_admin());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Department not found or not authorized';
  END IF;

  IF NOT v_department.printer_enabled OR v_department.printer_ip IS NULL THEN
    RAISE EXCEPTION 'No printer is configured for this Department';
  END IF;

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
    NULL,
    'test',
    v_department.id,
    v_department.restaurant_id,
    jsonb_build_object(
      'name', coalesce(v_department.printer_name, 'Printer'),
      'connection', coalesce(v_department.printer_connection, 'lan'),
      'ip', v_department.printer_ip,
      'port', coalesce(v_department.printer_port, 9100),
      'paperWidthMm', 80
    ),
    jsonb_build_object(
      'reportType', 'test_print',
      'departmentName', v_department.department_name,
      'printedAt', now()
    )
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_department_test_print(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_department_test_print(uuid) TO authenticated;
