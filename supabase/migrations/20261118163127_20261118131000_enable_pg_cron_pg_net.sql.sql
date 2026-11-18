/*
# Enable pg_cron and pg_net for renewal scheduling

## Purpose
Automatic subscription renewals need a scheduler. pg_cron provides the
schedule; pg_net lets cron-triggered SQL make an HTTP POST to the deployed
subscription-api edge function's process-renewals route (which charges due
renewals through Stripe and allocates credits).

## Change
- CREATE EXTENSION pg_cron (schema: cron, created automatically).
- CREATE EXTENSION pg_net (schema: net, created automatically).

No tables or policies change in this migration.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
