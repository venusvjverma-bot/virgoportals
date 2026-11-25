/**
 * Connect Gateway — Stripe Accounts v2 recipient onboarding (Module 2).
 *
 * One dedicated Stripe connected account per restaurant, created through the
 * Accounts v2 API with the Recipient configuration and Express dashboard, then
 * onboarded via a Stripe-hosted v2 Account Link. Status snapshots are stored in
 * restaurant_stripe_accounts (Module 1); hosts can read their own row but only
 * this function (service role) writes it.
 *
 * Isolation: this function deliberately does NOT share code with
 * subscription-api and never touches subscription/top-up tables or logic.
 * The classic v1 "type: express" flow is not used — Recipient configuration
 * exists only on Accounts v2.
 *
 * Retry safety: account creation carries a STABLE Stripe idempotency key
 * derived from the restaurant id ("connect-recipient-<restaurant_id>"). Two
 * concurrent requests therefore both resolve to the SAME Stripe account (Stripe
 * serialises identical keys and replays the first response), and a retry after
 * a Stripe success followed by a database failure recovers that same account
 * instead of creating another one. The database unique constraint on
 * restaurant_id is the second layer: a losing insert adopts the winning row.
 * (Stripe replays idempotency keys for 24h; beyond that the mapping-row check
 * covers reuse, since the row exists whenever a previous attempt completed.)
 *
 * Secrets used (never exposed to the frontend):
 * - STRIPE_SECRET_KEY (shared with subscription-api, read-only here)
 * - STRIPE_CONNECT_API_VERSION (optional override of the v2 Stripe-Version)
 */

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

type Db = ReturnType<typeof createClient>;

// ── Stripe Accounts v2 (raw HTTP — the pinned v1 SDK has no v2 surface) ─────

function stripeV2Version(): string {
  // v2 endpoints require a v2 Stripe-Version header, distinct from the v1
  // '2024-04-10' pin used by subscription-api. Overridable per environment.
  return Deno.env.get('STRIPE_CONNECT_API_VERSION') ?? '2026-10-28.preview';
}

class StripeError extends Error {
  readonly detail: string;
  constructor(detail: string) {
    super('Payment provider request failed.');
    this.detail = detail;
  }
}

async function stripeV2Request(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<Record<string, unknown>> {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('Stripe is not configured.');
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Stripe-Version': stripeV2Version(),
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const err = (data?.error ?? {}) as { message?: string; code?: string };
    throw new StripeError(`${res_status(response.status)} ${err.code ?? ''} ${err.message ?? 'unknown error'}`.trim());
  }
  return data ?? {};
}

function res_status(status: number): string {
  return `HTTP ${status}`;
}

// ── Auth + ownership ────────────────────────────────────────────────────────

async function verifyUser(supabase: Db, req: Request): Promise<{ userId: string; email: string | null } | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return { userId: data.user.id, email: data.user.email ?? null };
}

// ── Return/refresh URLs for Stripe-hosted onboarding ────────────────────────

function getOrigin(req: Request): string {
  const origin = req.headers.get('Origin');
  if (origin) return origin;
  const referer = req.headers.get('Referer');
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      // fall through
    }
  }
  return Deno.env.get('CONNECT_RETURN_ORIGIN') ?? new URL(req.url).origin;
}

// ── Status helpers ──────────────────────────────────────────────────────────

/** Statuses where onboarding is still possible; 'connected' is terminal here. */
function canOnboard(status: string): boolean {
  return status !== 'connected';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const user = await verifyUser(supabase, req);
    if (!user) return json({ error: 'Sign in to manage your payment connection.' }, 401);

    // Restaurant resolved from the verified session — never from the request body.
    const { data: restaurant, error: restError } = await supabase
      .from('restaurants')
      .select('id, name')
      .eq('owner_id', user.userId)
      .maybeSingle();
    if (restError) throw restError;
    if (!restaurant) return json({ error: 'No restaurant is linked to this account.' }, 403);

    const row = restaurant as { id: string; name: string | null };

    const { data: existing, error: mapError } = await supabase
      .from('restaurant_stripe_accounts')
      .select('stripe_account_id, onboarding_status')
      .eq('restaurant_id', row.id)
      .maybeSingle();
    if (mapError) throw mapError;

    let accountId: string;
    let status: string;

    if (existing) {
      accountId = (existing as { stripe_account_id: string }).stripe_account_id;
      status = (existing as { onboarding_status: string }).onboarding_status;
      if (!canOnboard(status)) {
        return json({ connected: true, status, onboardingUrl: null });
      }
    } else {
      // Stable idempotency key per restaurant: Stripe replays the first
      // response for concurrent/duplicate requests, so every path converges on
      // one connected account even before the database constraint is consulted.
      const account = await stripeV2Request(
        '/v2/core/accounts',
        {
        contact_email: user.email,
        display_name: row.name ?? 'Virgo Portals restaurant',
        dashboard: 'express',
        identity: { country: 'SE', entity_type: 'company' },
        configuration: {
          recipient: {
            capabilities: {
              stripe_balance: { stripe_transfers: { requested: true } },
            },
          },
        },
        defaults: {
          responsibilities: { fees_collector: 'application', losses_collector: 'application' },
        },
        metadata: { restaurant_id: row.id },
        },
        `connect-recipient-${row.id}`,
      );
      accountId = String(account.id ?? '');
      if (!accountId.startsWith('acct_')) {
        throw new StripeError('Stripe returned an unexpected account id.');
      }

      const { error: insertError } = await supabase.from('restaurant_stripe_accounts').insert({
        restaurant_id: row.id,
        stripe_account_id: accountId,
        onboarding_status: 'setup_required',
      });
      if (insertError) {
        if ((insertError as { code?: string }).code === '23505') {
          // Concurrent request or a previous Stripe-success/DB-failure retry:
          // the existing mapping always wins; never create a second account.
          const { data: winner, error: winnerError } = await supabase
            .from('restaurant_stripe_accounts')
            .select('stripe_account_id, onboarding_status')
            .eq('restaurant_id', row.id)
            .maybeSingle();
          if (winnerError || !winner) throw winnerError ?? new Error('Mapping vanished during race.');
          accountId = (winner as { stripe_account_id: string }).stripe_account_id;
          status = (winner as { onboarding_status: string }).onboarding_status;
          if (!canOnboard(status)) {
            return json({ connected: true, status, onboardingUrl: null });
          }
        } else {
          throw insertError;
        }
      } else {
        status = 'setup_required';
      }
    }

    // Stripe-hosted onboarding link (v2 Account Links, Recipient configuration).
    // A redirect back to the return URL is never treated as proof of completion;
    // status stays a snapshot updated only by later status-verification work.
    const origin = getOrigin(req);
    // configurations is response-only since 2026-11-18.endive — sending it
    // fails with 400 invalid_fields (use_case.account_onboarding.configurations:
    // Unknown field). The link's configuration is derived from the account.
    const link = await stripeV2Request('/v2/core/account_links', {
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          return_url: `${origin}/?connect=return`,
          refresh_url: `${origin}/?connect=refresh`,
        },
      },
    });
    const onboardingUrl = typeof link.url === 'string' ? link.url : null;
    if (!onboardingUrl) {
      throw new StripeError('Stripe returned no onboarding URL.');
    }

    return json({ connected: false, status, onboardingUrl });
  } catch (err) {
    if (err instanceof StripeError) {
      console.error('connect-gateway Stripe error:', err.detail);
      return json({ error: 'Stripe rejected the request. Please try again shortly.' }, 502);
    }
    console.error('connect-gateway error:', err instanceof Error ? err.message : err);
    return json({ error: 'Could not start the payment connection. Please try again.' }, 500);
  }
});
