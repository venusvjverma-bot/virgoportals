/*
# Backfill department_id for existing dishes

## Problem
The Departments & Events migration created a default department for each
restaurant but did NOT backfill `department_id` on existing dish records.
All pre-existing dishes retained `department_id = NULL` and `event_id = NULL`.

The new department-scoped menu queries (`listDishesByDepartment`,
`listDishesByEvent`, and the visitor-chat edge function) filter by
`department_id` or `event_id`, so these unlinked dishes became invisible
in both the host portal's Menu tab and the visitor chat — even though
the dish records themselves were never deleted.

## Fix
Link every dish that has `department_id IS NULL AND event_id IS NULL`
to its restaurant's default department (`is_default = true`). This is
a pure data-backfill UPDATE — no dish content is changed, no records
are deleted, and dishes already assigned to a department or event are
not touched.

## Scope
- 6 restaurants affected: Pong, SirDar Bar, Olive & Thyme, Cedar Lane
  Kitchen, Harbor Table, Saffron House
- 85 dishes total to be linked
- Restaurants with zero dishes (e.g. Apple UI Test) are unaffected

## Safety
- Only updates `department_id` column; all other columns untouched
- Only targets rows where both `department_id IS NULL` and `event_id IS NULL`
- Uses the restaurant's `is_default = true` department as the link target
- Idempotent: re-running finds zero unlinked dishes
*/

UPDATE dishes d
SET department_id = dep.id
FROM departments dep
WHERE dep.restaurant_id = d.restaurant_id
  AND dep.is_default = true
  AND d.department_id IS NULL
  AND d.event_id IS NULL;
