/*
# Default Automatic Availability to On schedule for departments

1. Modified Tables
   - `departments.schedule_available`: column default changed from false to
     true, so every newly created department starts with Automatic
     Availability enabled ("On schedule"). Existing rows are also updated to
     true — this is the requested behaviour flip for all current departments.
     Hosts can still toggle it off/on per department; the manual
     Active/Inactive status is untouched.

2. Security
   - No RLS, policy or grant changes.
*/

ALTER TABLE departments
  ALTER COLUMN schedule_available SET DEFAULT true;

UPDATE departments SET schedule_available = true WHERE schedule_available = false;