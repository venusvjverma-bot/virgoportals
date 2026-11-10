import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

/**
 * Provider-independent subscription API.
 *
 * Three concerns live here:
 *  1. Host-facing reads (own subscription, packages, payment history) and
 *     settings changes that carry no money (auto-renew toggle, package
 *     reschedule, cancellation at period end).
 *  2. A payment provider ADAPTER interface. No provider is connected yet —
 *     `getAdapter()` returns null until one is implemented. All payment
 *     confirmation flows through the adapter + webhooks; nothing here marks a
 *     payment successful on the basis of a frontend message.
 *  3. The renewal processor, intended to be invoked by a scheduled job
 *     (externally scheduled — see scheduler notes in the report). It expires
 *     due non-renewing subscriptions and reserves renewal cycles for the
 *     adapter to charge.
 *
 * Webhook verification: `verifyWebhook` is part of the adapter interface. The
 * generic webhook route rejects everything while no adapter is configured.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

type Db = ReturnType<typeof createClient>;

// ── Payment provider adapter interface ──────────────────────────────────────
// Implement this interface (in a new file, e.g. adapters/<provider>.ts) and
// register it in getAdapter() once a provider is chosen. Required credentials
// are provider-specific and must live in edge function secrets, never in the
// frontend.

export interface PaymentAdapter {
  readonly providerName: string;
  /** Verify a webhook signature and parse the event. Must throw on bad signature. */
  verifyWebhook(req: Request, db: Db): Promise<WebhookEvent | null>;
  /**
   * Charge a saved payment method for a reserved renewal cycle. Returns the
   * provider payment reference on success, or null when the provider reports
   * failure. Implementations must be safe to re-run.
   */
  chargeRenewal(args: {
    subscriptionRef: string;
    amountCents: number;
    currency: string;
    cycleNumber: number;
  }): Promise<{ ok: boolean; paymentRef: string | null; invoiceUrl: string | null }>;
  /** Create the provider-side recurring billing object for a new subscription. */
  createSubscription(args: {
    restaurantId: string;
    packageCode: string;
    amountCents: number;
  }): Promise<{ subscriptionRef: string; checkoutUrl: string | null }>;
}

export interface WebhookEvent {
  eventId: string;
  eventType: string;
  providerPaymentRef: string | null;
  succeeded: boolean;
}

/** Returns null until a provider adapter is implemented and configured. */
function getAdapter(): PaymentAdapter | null {
  // To connect a provider: implement PaymentAdapter, then return it here.
  // Example secrets that will be required (provider-specific):
  //   SUBSCRIPTION_PROVIDER_API_KEY  — provider secret key (server-side only)
  //   SUBSCRIPTION_PROVIDER_WEBHOOK_SECRET — webhook signature verification
  return null;
}

// ── Test-mode mock adapter ──────────────────────────────────────────────────
// Never used for real payments. Only active when SUBSCRIPTION_TEST_MODE_SECRET
// is configured, and every test action additionally requires that secret.
// All records are marked provider 'mock-test' with 'test_'-prefixed refs.

const TEST_PROVIDER = 'mock-test';

class MockTestAdapter implements PaymentAdapter {
  readonly providerName = TEST_PROVIDER;
  async verifyWebhook(): Promise<WebhookEvent | null> {
    return null; // webhooks are never simulated
  }
  async chargeRenewal(args: { cycleNumber: number }): Promise<{ ok: boolean; paymentRef: string | null; invoiceUrl: string | null }> {
    return { ok: true, paymentRef: `test_pay_${args.cycleNumber}_${crypto.randomUUID()}`, invoiceUrl: null };
  }
  async createSubscription(): Promise<{ subscriptionRef: string; checkoutUrl: string | null }> {
    return { subscriptionRef: `test_sub_${crypto.randomUUID()}`, checkoutUrl: null };
  }
}

function testModeSecret(): string | null {
  return Deno.env.get('SUBSCRIPTION_TEST_MODE_SECRET') ?? null;
}

function getTestAdapter(): PaymentAdapter | null {
  return testModeSecret() ? new MockTestAdapter() : null;
}

async function verifyUser(supabase: Db, req: Request): Promise<string | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

async function getOwnedRestaurant(supabase: Db, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

async function isAdminUser(supabase: Db, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

const SUBSCRIPTION_COLUMNS = `
  id, restaurant_id, status, package_id, scheduled_package_id, auto_renew,
  billing_anchor_day, period_start, period_end, cancel_at_period_end,
  canceled_at, expired_at, provider, provider_subscription_ref, created_at
`;

function packageNameMap(packages: Array<{ id: string; code: string; name: string; price_cents: number; credits: string }>) {
  return new Map(packages.map((p) => [p.id, p]));
}

interface PackageRow {
  id: string;
  code: string;
  name: string;
  price_cents: number | null;
  credits: string | number | null;
  sort_order?: number;
}

/** Database rows → camelCase with numeric coercion, so the client never sees undefined prices. */
function toPublicPackage(row: PackageRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    priceCents: Number(row.price_cents ?? 0),
    credits: Number(row.credits ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const route = url.pathname.split('/').filter(Boolean).pop() ?? '';

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // ── Webhook route (provider → server) ──
    if (route === 'webhook') {
      const adapter = getAdapter();
      if (!adapter) {
        return json({ error: 'No payment provider is configured.' }, 503);
      }
      const event = await adapter.verifyWebhook(req, supabase);
      if (!event) return json({ error: 'Invalid webhook payload.' }, 400);

      // Duplicate-event protection: unique (provider, event_id). A replay
      // loses the insert race and is dropped before any side effects.
      const { data: claimed, error: claimError } = await supabase
        .from('subscription_webhook_events')
        .insert({ provider: adapter.providerName, event_id: event.eventId, event_type: event.eventType })
        .select('id');
      if (claimError) {
        if ((claimError as { code?: string }).code === '23505') return json({ received: true, duplicate: true });
        throw claimError;
      }
      if (!claimed || claimed.length === 0) return json({ received: true, duplicate: true });

      if (event.providerPaymentRef) {
        const { data: payment, error: paymentError } = await supabase
          .from('subscription_payments')
          .select('id, status, subscription_id, package_id, cycle_number')
          .eq('provider_payment_ref', event.providerPaymentRef)
          .maybeSingle();
        if (paymentError) throw paymentError;
        if (payment) {
          const newStatus = event.succeeded ? 'succeeded' : 'failed';
          if (payment.status === 'pending') {
            const { error: updError } = await supabase
              .from('subscription_payments')
              .update({ status: newStatus, paid_at: event.succeeded ? new Date().toISOString() : null })
              .eq('id', (payment as { id: string }).id);
            if (updError) throw updError;
          }
        }
      }
      return json({ received: true });
    }

    // ── Scheduled renewal processing (external scheduler → server) ──
    // Protected by the service role key passed as a bearer token by the
    // scheduler. Requires the SCHEDULED_RENEWAL_SECRET edge function secret
    // to be configured; returns 503 until it is set.
    if (route === 'process-renewals') {
      const schedulerSecret = Deno.env.get('SCHEDULED_RENEWAL_SECRET');
      if (!schedulerSecret) {
        return json({ error: 'Renewal scheduling is not configured (SCHEDULED_RENEWAL_SECRET missing).' }, 503);
      }
      const header = req.headers.get('Authorization') ?? '';
      if (header !== `Bearer ${schedulerSecret}`) {
        return json({ error: 'Unauthorized.' }, 401);
      }

      const expired = await supabase.rpc('expire_due_subscriptions');
      if (expired.error) throw expired.error;

      const { data: due, error: dueError } = await supabase
        .from('host_subscriptions')
        .select(SUBSCRIPTION_COLUMNS)
        .eq('status', 'active')
        .eq('auto_renew', true)
        .eq('cancel_at_period_end', false)
        .lte('period_end', new Date().toISOString());
      if (dueError) throw dueError;

      const results: Array<{ subscriptionId: string; cycle: number | null }> = [];
      for (const sub of (due ?? []) as Array<Record<string, unknown>>) {
        const reserved = await supabase.rpc('process_subscription_renewal', {
          p_subscription_id: sub.id,
        });
        if (reserved.error) throw reserved.error;
        const [ok, cycle] = reserved.data as [boolean, number];
        if (!ok) continue;
        const adapter = getAdapter();
        if (!adapter) {
          // No provider connected: the reserved cycle stays pending and no
          // credits are allocated. Nothing is simulated as paid.
          results.push({ subscriptionId: String(sub.id), cycle });
          continue;
        }
        const charge = await adapter.chargeRenewal({
          subscriptionRef: String(sub.provider_subscription_ref ?? ''),
          amountCents: 0,
          currency: 'USD',
          cycleNumber: Number(cycle),
        });
        if (charge.ok && charge.paymentRef) {
          await supabase.rpc('allocate_subscription_credits', {
            p_restaurant_id: sub.restaurant_id,
            p_package_id: (sub.scheduled_package_id ?? sub.package_id) as string,
            p_cycle_number: Number(cycle),
            p_provider_payment_ref: charge.paymentRef,
          });
        }
        results.push({ subscriptionId: String(sub.id), cycle });
      }

      return json({ expiredCount: expired.data ?? 0, processed: results.length, results });
    }

    // ── Host + admin routes (authenticated) ──
    const userId = await verifyUser(supabase, req);
    if (!userId) return json({ error: 'Please sign in to continue.' }, 401);

    const body = await req.json().catch(() => null);
    const action = body?.action as string | undefined;

    // Admin read-only monitoring view.
    if (action === 'adminListSubscriptions') {
      if (!(await isAdminUser(supabase, userId))) {
        return json({ error: 'This account is not allowed to use the admin area.' }, 403);
      }
      const { data: subs, error: subsError } = await supabase
        .from('host_subscriptions')
        .select(
          `${SUBSCRIPTION_COLUMNS},
           restaurants!inner(owner_id, name, owner_email),
           packages:subscription_packages!host_subscriptions_package_id_fkey(code, name),
           scheduled:subscription_packages!host_subscriptions_scheduled_package_id_fkey(code, name)`
        )
        .order('created_at', { ascending: false });
      if (subsError) throw subsError;

      const { data: packages, error: pkgError } = await supabase
        .from('subscription_packages')
        .select('id, code, name, price_cents, credits')
        .order('sort_order');
      if (pkgError) throw pkgError;
      const pkgMap = packageNameMap((packages ?? []) as Array<{ id: string; code: string; name: string; price_cents: number; credits: string }>);

      const { data: balances, error: balError } = await supabase
        .from('host_credits')
        .select('restaurant_id, balance');
      if (balError) throw balError;
      const balanceMap = new Map(((balances ?? []) as Array<{ restaurant_id: string; balance: string }>).map((b) => [b.restaurant_id, Number(b.balance)]));

      const { data: payments, error: payError } = await supabase
        .from('subscription_payments')
        .select('subscription_id, cycle_number, amount_cents, status, package_id, provider_payment_ref, provider_invoice_url, paid_at, created_at')
        .order('created_at', { ascending: false });
      if (payError) throw payError;

      const rows = (subs ?? []) as Array<Record<string, unknown>>;
      const out = rows.map((row) => {
        const restaurant = row.restaurants as { owner_id: string; name: string; owner_email: string };
        const pkg = pkgMap.get(((row.packages ?? {}) as { id: string }).id);
        const sched = pkgMap.get((((row.scheduled ?? {}) as { id: string }) || {}).id);
        return {
          subscriptionId: row.id,
          ownerId: restaurant.owner_id,
          ownerEmail: restaurant.owner_email,
          restaurantName: restaurant.name,
          packageCode: pkg?.code ?? '',
          packageName: pkg?.name ?? '',
          scheduledPackageCode: sched?.code ?? null,
          scheduledPackageName: sched?.name ?? null,
          status: row.status,
          autoRenew: row.auto_renew,
          periodStart: row.period_start,
          periodEnd: row.period_end,
          cancelAtPeriodEnd: row.cancel_at_period_end,
          nextRenewal: row.status === 'active' && row.auto_renew === true && row.cancel_at_period_end === false ? row.period_end : null,
          balance: balanceMap.get(row.restaurant_id) ?? 0,
          payments: ((payments ?? []) as Array<Record<string, unknown>>)
            .filter((p) => p.subscription_id === row.id)
            .map((p) => ({
              cycleNumber: p.cycle_number,
              amountCents: p.amount_cents,
              status: p.status,
              packageName: pkgMap.get(p.package_id as string)?.name ?? null,
              paymentRef: p.provider_payment_ref,
              invoiceUrl: p.provider_invoice_url,
              paidAt: p.paid_at,
              createdAt: p.created_at,
            })),
        };
      });
      return json({ subscriptions: out });
    }

    // ── Host routes: scoped to the caller's own restaurant ──
    const restaurantId = await getOwnedRestaurant(supabase, userId);
    if (!restaurantId) return json({ error: 'This account does not own a restaurant portal.' }, 403);

    if (action === 'getSubscription') {
      const [{ data: packages, error: pkgError }, { data: sub, error: subError }] = await Promise.all([
        supabase.from('subscription_packages').select('id, code, name, price_cents, credits, sort_order').eq('is_active', true).order('sort_order'),
        supabase
          .from('host_subscriptions')
          .select(
            `${SUBSCRIPTION_COLUMNS},
             packages:subscription_packages!host_subscriptions_package_id_fkey(code, name, price_cents, credits),
             scheduled:subscription_packages!host_subscriptions_scheduled_package_id_fkey(code, name, price_cents, credits)`
          )
          .eq('restaurant_id', restaurantId)
          .maybeSingle(),
      ]);
      if (pkgError) throw pkgError;
      if (subError) throw subError;

      const { data: balanceData, error: balanceError } = await supabase.rpc('check_host_credit', {
        p_restaurant_id: restaurantId,
      });
      if (balanceError) throw balanceError;

      let payments: Array<Record<string, unknown>> = [];
      if (sub) {
        const { data: payRows, error: payError } = await supabase
          .from('subscription_payments')
          .select('cycle_number, amount_cents, status, package_id, provider_payment_ref, provider_invoice_url, paid_at, created_at')
          .eq('subscription_id', (sub as Record<string, unknown>).id as string)
          .order('cycle_number', { ascending: false });
        if (payError) throw payError;
        const pkgCodeMap = new Map(((packages ?? []) as Array<{ id: string; code: string; name: string }>).map((p) => [p.id, p]));
        payments = ((payRows ?? []) as Array<Record<string, unknown>>).map((p) => ({
          ...p,
          packageName: pkgCodeMap.get(p.package_id as string)?.name ?? null,
        }));
      }

      const subRow = (sub ?? null) as Record<string, unknown> | null;
      return json({
        packages: ((packages ?? []) as PackageRow[]).map(toPublicPackage),
        subscription: subRow
          ? {
              status: subRow.status,
              packageName: ((subRow.packages ?? {}) as { name?: string }).name ?? '',
              packageCode: ((subRow.packages ?? {}) as { code?: string }).code ?? '',
              scheduledPackageName: ((subRow.scheduled ?? {}) as { name?: string } | null)?.name ?? null,
              scheduledPackageCode: ((subRow.scheduled ?? {}) as { code?: string } | null)?.code ?? null,
              autoRenew: subRow.auto_renew,
              periodStart: subRow.period_start,
              periodEnd: subRow.period_end,
              cancelAtPeriodEnd: subRow.cancel_at_period_end,
              nextRenewal:
                subRow.status === 'active' && subRow.auto_renew === true && subRow.cancel_at_period_end === false
                  ? subRow.period_end
                  : null,
              provider: subRow.provider,
            }
          : null,
        balance: Number(balanceData ?? 0),
        payments: payments.map((p) => ({
          cycleNumber: p.cycle_number,
          amountCents: p.amount_cents,
          status: p.status,
          packageName: (p as { packageName?: string | null }).packageName ?? null,
          paymentRef: p.provider_payment_ref,
          invoiceUrl: p.provider_invoice_url,
          paidAt: p.paid_at,
          createdAt: p.created_at,
        })),
      });
    }

    // Settings changes that carry no money. Hosts can never mark a payment
    // successful or allocate credits — those are service-role paths only.
    if (action === 'setAutoRenew') {
      const value = body?.value === true;
      const { error } = await supabase
        .from('host_subscriptions')
        .update({ auto_renew: value, cancel_at_period_end: value ? false : undefined, updated_at: new Date().toISOString() })
        .eq('restaurant_id', restaurantId);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === 'changePackage') {
      const packageCode = String(body?.packageCode ?? '');
      const { data: pkg, error: pkgError } = await supabase
        .from('subscription_packages')
        .select('id')
        .eq('code', packageCode)
        .eq('is_active', true)
        .maybeSingle();
      if (pkgError) throw pkgError;
      if (!pkg) return json({ error: 'That package is not available.' }, 400);

      const { data: sub, error: subError } = await supabase
        .from('host_subscriptions')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (subError) throw subError;
      if (!sub) return json({ error: 'No subscription to change.' }, 400);

      const { error } = await supabase
        .from('host_subscriptions')
        .update({ scheduled_package_id: (pkg as { id: string }).id, updated_at: new Date().toISOString() })
        .eq('restaurant_id', restaurantId);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === 'cancelSubscription') {
      // Cancellation takes effect at the end of the current paid period.
      const { error } = await supabase
        .from('host_subscriptions')
        .update({ cancel_at_period_end: true, auto_renew: false, canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('restaurant_id', restaurantId);
      if (error) throw error;
      return json({ ok: true });
    }

    // ── TEST-MODE ONLY actions ──────────────────────────────────────────────
    // Every test action requires (a) an authenticated host who owns the
    // restaurant (checked above) AND (b) the caller to pass the server-side
    // SUBSCRIPTION_TEST_MODE_SECRET. Without that secret configured on the
    // server these routes return 503 and do nothing.
    const testSecret = testModeSecret();
    const providedTestSecret = String(body?.testSecret ?? '');
    const testAuthorized = testSecret !== null && providedTestSecret === testSecret;

    if (action === 'testCheckout' || action === 'testRenewal' || action === 'testExpireNow') {
      if (!testAuthorized) {
        return json({ error: 'Test mode is not enabled or the test secret is invalid.' }, 503);
      }
    }

    if (action === 'testCheckout') {
      const packageCode = String(body?.packageCode ?? '');
      const fail = body?.fail === true;

      const { data: pkg, error: pkgError } = await supabase
        .from('subscription_packages')
        .select('id, code')
        .eq('code', packageCode)
        .eq('is_active', true)
        .maybeSingle();
      if (pkgError) throw pkgError;
      if (!pkg) return json({ error: 'That package is not available.' }, 400);

      const { data: existing, error: existingError } = await supabase
        .from('host_subscriptions')
        .select('id, status')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing && (existing as { status: string }).status === 'active') {
        return json({ error: 'This restaurant already has an active subscription.' }, 409);
      }

      const adapter = getTestAdapter();
      if (!adapter) return json({ error: 'Test mode is not enabled.' }, 503);
      const created = await adapter.createSubscription();

      const packageId = (pkg as { id: string }).id;
      if (existing) {
        // Incomplete / expired / canceled row: reset it for the test purchase.
        const { error: resetError } = await supabase
          .from('host_subscriptions')
          .update({
            status: 'incomplete',
            package_id: packageId,
            scheduled_package_id: null,
            auto_renew: true,
            cancel_at_period_end: false,
            canceled_at: null,
            expired_at: null,
            provider: TEST_PROVIDER,
            provider_subscription_ref: created.subscriptionRef,
            billing_anchor_day: new Date().getUTCDate(),
            period_start: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', (existing as { id: string }).id);
        if (resetError) throw resetError;
      } else {
        const { error: insertError } = await supabase
          .from('host_subscriptions')
          .insert({
            restaurant_id: restaurantId,
            package_id: packageId,
            status: 'incomplete',
            provider: TEST_PROVIDER,
            provider_subscription_ref: created.subscriptionRef,
            billing_anchor_day: new Date().getUTCDate(),
            period_start: new Date().toISOString(),
          });
        if (insertError) throw insertError;
      }

      if (fail) {
        // Simulate a failed checkout payment: activate nothing, record nothing
        // in payment history, mark the subscription payment_failed.
        const { error: failError } = await supabase
          .from('host_subscriptions')
          .update({ status: 'payment_failed', updated_at: new Date().toISOString() })
          .eq('restaurant_id', restaurantId);
        if (failError) throw failError;
        return json({ ok: false, simulated: 'failed', message: 'Test payment failed. No credits were allocated.' });
      }

      // Successful simulated payment → the REAL activation + allocation path.
      const { data: sub, error: subError } = await supabase
        .from('host_subscriptions')
        .select('id, period_start')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (subError) throw subError;
      const { data: alloc, error: allocError } = await supabase.rpc('allocate_subscription_credits', {
        p_restaurant_id: restaurantId,
        p_package_id: packageId,
        p_cycle_number: 1,
        p_provider_payment_ref: `test_pay_1_${crypto.randomUUID()}`,
      });
      if (allocError) throw allocError;
      const [allocated, newBalance, periodEnd] = alloc as [boolean, string, string];
      void sub;
      return json({
        ok: allocated,
        simulated: 'succeeded',
        balance: Number(newBalance),
        periodEnd,
        testRef: created.subscriptionRef,
      });
    }

    if (action === 'testRenewal') {
      // Drives the REAL renewal processor: expire due subs, reserve the next
      // cycle, then "charge" via the mock adapter and allocate on success.
      // fail: simulate a declined charge. forceDue: shorten this test
      // subscription's period so it is due now (test subscription only).
      const fail = body?.fail === true;
      const forceDue = body?.forceDue === true;

      const { data: sub, error: subError } = await supabase
        .from('host_subscriptions')
        .select(SUBSCRIPTION_COLUMNS)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (subError) throw subError;
      const subRow = (sub ?? null) as Record<string, unknown> | null;
      if (!subRow) return json({ error: 'No subscription to renew.' }, 400);

      if (forceDue) {
        const { error: dueError } = await supabase
          .from('host_subscriptions')
          .update({ period_end: new Date(Date.now() - 60_000).toISOString(), updated_at: new Date().toISOString() })
          .eq('id', String(subRow.id));
        if (dueError) throw dueError;
      }

      const { data: expired, error: expiredError } = await supabase.rpc('expire_due_subscriptions');
      if (expiredError) throw expiredError;

      // Re-read: expire_due_subscriptions may have expired this subscription
      // if it was not auto-renewing. Only auto-renewing actives are processed.
      const { data: sub2, error: sub2Error } = await supabase
        .from('host_subscriptions')
        .select(SUBSCRIPTION_COLUMNS)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (sub2Error) throw sub2Error;
      const current = (sub2 ?? null) as Record<string, unknown> | null;
      if (!current || current.status !== 'active' || current.auto_renew !== true || current.cancel_at_period_end === true) {
        return json({ ok: false, simulated: 'not-renewable', expiredCount: expired.data ?? 0,
          message: 'Subscription is not in a renewable state (expired, auto-renew off, or canceled).' });
      }

      const reserved = await supabase.rpc('process_subscription_renewal', { p_subscription_id: String(current.id) });
      if (reserved.error) throw reserved.error;
      const [ok, cycle] = reserved.data as [boolean, number];
      if (!ok) return json({ ok: false, simulated: 'duplicate', cycle, message: 'No new cycle was reserved (duplicate or blocked).' });

      const packageId = (current.scheduled_package_id ?? current.package_id) as string;
      if (fail) {
        const { error: markError } = await supabase
          .from('subscription_payments')
          .update({ status: 'failed', provider_payment_ref: null, provider: TEST_PROVIDER })
          .eq('subscription_id', String(current.id))
          .eq('cycle_number', Number(cycle));
        if (markError) throw markError;
        const { error: statusError } = await supabase
          .from('host_subscriptions')
          .update({ status: 'payment_failed', updated_at: new Date().toISOString() })
          .eq('id', String(current.id));
        if (statusError) throw statusError;
        return json({ ok: false, simulated: 'failed', cycle, message: 'Test renewal payment failed. No credits were allocated.' });
      }

      const adapter = getTestAdapter();
      if (!adapter) return json({ error: 'Test mode is not enabled.' }, 503);
      const charge = await adapter.chargeRenewal({ cycleNumber: Number(cycle) });
      if (!charge.ok || !charge.paymentRef) {
        return json({ ok: false, simulated: 'failed', cycle });
      }
      const { data: alloc, error: allocError } = await supabase.rpc('allocate_subscription_credits', {
        p_restaurant_id: restaurantId,
        p_package_id: packageId,
        p_cycle_number: Number(cycle),
        p_provider_payment_ref: charge.paymentRef,
      });
      if (allocError) throw allocError;
      const [allocated, newBalance, periodEnd] = alloc as [boolean, string, string];
      return json({ ok: allocated, simulated: 'succeeded', cycle, balance: Number(newBalance), periodEnd });
    }

    if (action === 'testExpireNow') {
      // Marks the test subscription's paid period as already over, without
      // touching real billing rules. Combined with expire_due_subscriptions
      // (called by testRenewal) this exercises expiry + credit preservation.
      const { data: sub, error: subError } = await supabase
        .from('host_subscriptions')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (subError) throw subError;
      if (!sub) return json({ error: 'No subscription.' }, 400);
      const { error: updError } = await supabase
        .from('host_subscriptions')
        .update({ period_end: new Date(Date.now() - 60_000).toISOString(), updated_at: new Date().toISOString() })
        .eq('id', (sub as { id: string }).id);
      if (updError) throw updError;
      const { data: expired, error: expiredError } = await supabase.rpc('expire_due_subscriptions');
      if (expiredError) throw expiredError;
      return json({ ok: true, expiredCount: expired.data ?? 0 });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error.';
    return json({ error: message }, 500);
  }
});
