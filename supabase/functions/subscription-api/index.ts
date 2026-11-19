import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import * as stripeAdapter from './stripeAdapter.ts';
import {
  stripeConfigured,
  verifyStripeWebhook,
  createSubscriptionCheckout,
  createTopupCheckout,
  getStripeSecret,
} from './stripeAdapter.ts';

/**
 * Provider-independent subscription API.
 *
 * Three concerns live here:
 *  1. Host-facing reads (own subscription, packages, payment history) and
 *     settings changes that carry no money (auto-renew toggle, package
 *     reschedule, cancellation at period end).
 *  2. A payment provider ADAPTER interface. All payment confirmation flows
 *     through webhooks; nothing here marks a payment successful on the basis
 *     of a frontend message.
 *  3. An expiry sweep invoked by a scheduled job. Stripe owns recurring
 *     charging (Option A) and reports renewals via webhooks; this API only
 *     expires due non-renewing subscriptions and mirrors Stripe's outcomes.
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
  /** Create the provider-side recurring billing object for a new subscription. */
  createSubscription(args: {
    restaurantId: string;
    packageCode: string;
    amountCents: number;
    currency: string;
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
  if (!stripeConfigured()) return null;
  return stripeAdapter;
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
  /** Mock-only simulated charge, used by the test-mode renewal action. */
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

// ── Stripe adapter bridge ───────────────────────────────────────────────────
// Adapts the Stripe helper module to the PaymentAdapter interface used by the
// generic webhook path. Stripe owns recurring charging (Option A): renewals
// arrive as invoice/subscription webhooks and are processed by
// handleStripeBillingWebhook — there is no off-session charging here.

const STRIPE_PROVIDER = 'stripe';

const stripeBridge: PaymentAdapter = {
  providerName: STRIPE_PROVIDER,
  async verifyWebhook(req: Request, _db: Db): Promise<WebhookEvent | null> {
    const event = await verifyStripeWebhook(req);
    if (!event) return null;
    return {
      eventId: String(event.id ?? ''),
      eventType: String(event.type ?? ''),
      providerPaymentRef: extractPaymentRef(event),
      succeeded: extractSucceeded(event),
    };
  },
  async createSubscription(args: {
    restaurantId: string;
    packageCode: string;
    amountCents: number;
    currency: string;
  }): Promise<{ subscriptionRef: string; checkoutUrl: string | null }> {
    // Real subscription creation happens through Checkout Sessions in the
    // dedicated checkout route (needs host email + return URLs); this
    // interface method is only used by the test-mode flow.
    return { subscriptionRef: '', checkoutUrl: null };
  },
};

function extractPaymentRef(event: Record<string, unknown>): string | null {
  const type = String(event.type ?? '');
  const object = (event.data as { object?: Record<string, unknown> } | undefined)?.object ?? {};
  if (type.startsWith('checkout.session.')) {
    const session = object as { id?: string; payment_intent?: string | null };
    return (session.payment_intent as string) ?? `cs_${session.id}`;
  }
  if (type.startsWith('payment_intent.')) {
    return `pi_${(object as { id?: string }).id}`;
  }
  if (type.startsWith('charge.')) {
    return ((object as { payment_intent?: string }).payment_intent as string) ?? null;
  }
  return (object as { id?: string }).id ? `obj_${(object as { id: string }).id}` : null;
}

function extractSucceeded(event: Record<string, unknown>): boolean {
  const type = String(event.type ?? '');
  return [
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'payment_intent.succeeded',
    'payment_intent.amount_capturable_updated',
  ].includes(type);
}

function getTestAdapter(): MockTestAdapter | null {
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

/** Top-ups require an active paid subscription whose period has not yet ended. */
async function canPurchaseTopup(supabase: Db, restaurantId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('host_subscriptions')
    .select('status, period_end')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (error) throw error;
  const sub = data as { status: string; period_end: string | null } | null;
  if (!sub || sub.status !== 'active') return false;
  return !(sub.period_end && sub.period_end <= new Date().toISOString());
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

interface TopupPackageRow {
  id: string;
  code: string;
  name: string;
  credits: string | number | null;
  price_cents: number | null;
  sort_order?: number;
}

function toPublicTopupPackage(row: TopupPackageRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    credits: Number(row.credits ?? 0),
    priceCents: Number(row.price_cents ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

/** Unified payment record across subscription cycles and credit top-ups. */
function subPaymentRecord(p: Record<string, unknown>, pkgName: string | null): Record<string, unknown> {
  const cycle = Number(p.cycle_number);
  return {
    type: cycle === 1 ? 'subscription' : 'renewal',
    description: pkgName,
    credits: null,
    cycleNumber: cycle,
    amountCents: p.amount_cents,
    vatCents: (p.vat_cents as number | null) ?? null,
    totalCents: (p.total_cents as number | null) ?? null,
    currency: (p.currency as string | null) ?? 'SEK',
    status: p.status,
    paymentRef: p.provider_payment_ref,
    invoiceUrl: p.provider_invoice_url,
    provider: p.provider,
    paidAt: p.paid_at,
    createdAt: p.created_at,
  };
}

function topupPaymentRecord(t: Record<string, unknown>, pkgName: string | null): Record<string, unknown> {
  return {
    type: 'topup',
    description: pkgName,
    credits: Number(t.credits),
    cycleNumber: null,
    amountCents: t.amount_cents,
    vatCents: (t.vat_cents as number | null) ?? null,
    totalCents: (t.total_cents as number | null) ?? null,
    currency: (t.currency as string | null) ?? 'SEK',
    status: t.status,
    paymentRef: t.provider_payment_ref,
    invoiceUrl: t.provider_invoice_url,
    provider: t.provider,
    paidAt: t.paid_at,
    createdAt: t.created_at,
  };
}

// ── Stripe Billing renewal processing ──────────────────────────────────────
// Stripe owns recurring billing: it charges the saved payment method, issues
// the recurring invoice, and reports the outcome via webhooks. We mirror the
// outcome into our own tables (activation, credits, history) — never the
// reverse. Renewal events carry no checkout metadata; they are routed by the
// Stripe SUBSCRIPTION id stored on host_subscriptions.provider_subscription_ref
// (the customer id is kept alongside in provider_customer_ref).

/** Retrieve an invoice's charged amount + currency from its lines (it carries no amount of its own). */
async function getInvoiceAmount(invoiceId: string): Promise<{ amount: number | null; currency: string | null }> {
  const { Stripe } = await import('npm:stripe@14.25.0');
  const stripe = new Stripe(getStripeSecret()!, { apiVersion: '2024-04-10' });
  const inv = await stripe.invoices.retrieve(invoiceId);
  const line = inv.lines?.data?.[0] as { amount?: number; currency?: string } | undefined;
  return {
    amount: typeof line?.amount === 'number' && line.amount > 0 ? line.amount : null,
    currency: line?.currency?.toUpperCase() ?? null,
  };
}

/** Map a Stripe subscription id to our subscription row (by ref or by customer). */
async function findSubscriptionByStripeRef(
  supabase: Db,
  subscriptionId: string | null,
  customerId: string | null
): Promise<Record<string, unknown> | null> {
  if (subscriptionId) {
    const { data } = await supabase
      .from('host_subscriptions')
      .select(SUBSCRIPTION_COLUMNS)
      .eq('provider', STRIPE_PROVIDER)
      .eq('provider_subscription_ref', subscriptionId)
      .maybeSingle();
    if (data) return data as Record<string, unknown>;
  }
  if (customerId) {
    const { data } = await supabase
      .from('host_subscriptions')
      .select(SUBSCRIPTION_COLUMNS)
      .eq('provider', STRIPE_PROVIDER)
      .eq('provider_customer_ref', customerId)
      .maybeSingle();
    if (data) return data as Record<string, unknown>;
  }
  return null;
}

/** Next unprocessed cycle number for a subscription (max existing cycle + 1). */
async function nextCycleNumber(supabase: Db, subscriptionId: string): Promise<number> {
  const { data } = await supabase
    .from('subscription_payments')
    .select('cycle_number')
    .eq('subscription_id', subscriptionId)
    .order('cycle_number', { ascending: false })
    .limit(1);
  const rows = (data ?? []) as Array<{ cycle_number: number }>;
  return Number(rows[0]?.cycle_number ?? 0) + 1;
}

/** Resolve the package from the invoice's price metadata, falling back to the row's package. */
async function resolveRenewalPackage(
  supabase: Db,
  invoiceId: string,
  fallbackPackageId: string
): Promise<string> {
  const { Stripe } = await import('npm:stripe@14.25.0');
  const stripe = new Stripe(getStripeSecret()!, { apiVersion: '2024-04-10' });
  const inv = (await stripe.invoices.retrieve(invoiceId, { expand: ['lines.data.price'] })) as unknown as {
    lines?: { data?: Array<{ price?: { metadata?: Record<string, string> } }> };
  };
  const code = inv.lines?.data?.[0]?.price?.metadata?.package_code;
  if (code) {
    const { data } = await supabase
      .from('subscription_packages')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (data) return (data as { id: string }).id;
  }
  return fallbackPackageId;
}

async function handleStripeBillingWebhook(event: Record<string, unknown>, supabase: Db): Promise<Response> {
  const eventId = String(event.id ?? '');
  const eventType = String(event.type ?? '');
  const object = (event.data as { object?: Record<string, unknown> } | undefined)?.object ?? {};

  // ── Successful recurring payment (renewal) ──
  if (eventType === 'invoice.paid' || eventType === 'invoice.payment_succeeded') {
    const invoice = object as {
      id?: string;
      customer?: string | null;
      subscription?: string | null;
      billing_reason?: string;
      amount_paid?: number;
      currency?: string;
      lines?: { data?: Array<{ amount?: number; currency?: string }> };
    };
    // The first invoice (billing_reason 'subscription_create') is the checkout
    // confirmation — the checkout.session handler already processed it. Later
    // invoices (subscription_cycle renewals, subscription_update anchor
    // resets/upgrades) are genuine charges that must allocate credits.
    if (invoice.billing_reason === 'subscription_create' || invoice.billing_reason === 'upcoming') {
      return json({ received: true, ignored_reason: invoice.billing_reason });
    }

    const ourSub = await findSubscriptionByStripeRef(supabase, invoice.subscription ?? null, invoice.customer ?? null);
    if (!ourSub) return json({ received: true, no_match: true });

    const cycle = await nextCycleNumber(supabase, String(ourSub.id));
    let amount = typeof invoice.amount_paid === 'number' && invoice.amount_paid > 0 ? invoice.amount_paid : null;
    let currency = invoice.currency?.toUpperCase() ?? null;
    if (amount === null && invoice.id) {
      const fromLines = await getInvoiceAmount(invoice.id);
      amount = fromLines.amount;
      currency = currency ?? fromLines.currency;
    }
    if (amount === null) {
      console.error('Stripe renewal invoice without a usable amount', { eventId, invoiceId: invoice.id });
      return json({ received: true, error: 'Missing amount.' }, 400);
    }

    const packageId = invoice.id
      ? await resolveRenewalPackage(supabase, invoice.id, String(ourSub.package_id))
      : String(ourSub.package_id);

    const { data: alloc, error: allocError } = await supabase.rpc('allocate_subscription_credits', {
      p_restaurant_id: ourSub.restaurant_id,
      p_package_id: packageId,
      p_cycle_number: cycle,
      p_provider_payment_ref: `in_${invoice.id}`,
      p_vat_cents: Math.round(amount / 5),
      p_total_cents: amount,
    });
    if (allocError) throw allocError;
    void currency;
    return json({ received: true, renewed: (alloc as [boolean, unknown, unknown] | null)?.[0] ?? false, cycle });
  }

  // ── Failed recurring payment ──
  if (eventType === 'invoice.payment_failed') {
    const invoice = object as { id?: string; customer?: string | null; subscription?: string | null; attempt_count?: number };
    const ourSub = await findSubscriptionByStripeRef(supabase, invoice.subscription ?? null, invoice.customer ?? null);
    if (!ourSub) return json({ received: true, no_match: true });

    // Stripe retries automatically; we only reflect the failed state. No
    // credits are allocated and no payment row is created — the eventual
    // invoice.paid (after a successful retry) drives allocation.
    await supabase
      .from('host_subscriptions')
      .update({ status: 'payment_failed', updated_at: new Date().toISOString() })
      .eq('id', String(ourSub.id));
    return json({ received: true, marked: 'payment_failed', attempt: invoice.attempt_count ?? null });
  }

  // ── Payment needs host action (3D Secure / authentication) ──
  if (eventType === 'invoice.payment_action_required') {
    const invoice = object as { customer?: string | null; subscription?: string | null };
    const ourSub = await findSubscriptionByStripeRef(supabase, invoice.subscription ?? null, invoice.customer ?? null);
    if (!ourSub) return json({ received: true, no_match: true });
    // Keep the subscription active (Stripe holds the invoice open and retries
    // after authentication) but flag it so the dashboard can prompt the host.
    await supabase
      .from('host_subscriptions')
      .update({ status: 'payment_failed', updated_at: new Date().toISOString() })
      .eq('id', String(ourSub.id));
    return json({ received: true, marked: 'payment_action_required' });
  }

  // ── Subscription lifecycle sync ──
  if (eventType === 'customer.subscription.updated' || eventType === 'customer.subscription.deleted') {
    const sub = object as {
      id?: string;
      customer?: string | null;
      status?: string;
      cancel_at_period_end?: boolean;
      current_period_end?: number;
      canceled_at?: number | null;
  };
    const ourSub = await findSubscriptionByStripeRef(supabase, sub.id ?? null, sub.customer ?? null);
    if (!ourSub) return json({ received: true, no_match: true });

    if (eventType === 'customer.subscription.deleted' || sub.status === 'canceled') {
      await supabase
        .from('host_subscriptions')
        .update({
          status: 'canceled',
          canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', String(ourSub.id));
      return json({ received: true, marked: 'canceled' });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof sub.cancel_at_period_end === 'boolean') {
      updates.cancel_at_period_end = sub.cancel_at_period_end;
      updates.auto_renew = !sub.cancel_at_period_end;
    }
    if (typeof sub.current_period_end === 'number') {
      updates.period_end = new Date(sub.current_period_end * 1000).toISOString();
    }
    if (sub.status === 'active' && ourSub.status !== 'active') {
      updates.status = 'active';
    }
    await supabase.from('host_subscriptions').update(updates).eq('id', String(ourSub.id));
    return json({ received: true, synced: true });
  }

  return json({ received: true, ignored: eventType });
}

// ── Stripe webhook helpers ──────────────────────────────────────────────────

function getBearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null;
}

function getOrigin(req: Request): string {
  // The deployed function sits behind the Supabase functions domain; the
  // app itself is served from the request's Origin when present.
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
  return Deno.env.get('CHECKOUT_RETURN_ORIGIN') ?? new URL(req.url).origin;
}

interface CheckoutMeta extends Record<string, string> {
  kind: 'subscription' | 'topup';
  restaurant_id: string;
  package_code: string;
}

function getCheckoutMeta(event: Record<string, unknown>): CheckoutMeta | null {
  const object = (event.data as { object?: Record<string, unknown> } | undefined)?.object ?? {};
  const metadata = (object.metadata ?? {}) as Record<string, string>;
  if (!metadata.kind || !metadata.restaurant_id || !metadata.package_code) return null;
  return metadata as CheckoutMeta;
}

function getAmountFromEvent(event: Record<string, unknown>): { amount: number | null; currency: string | null } {
  const object = (event.data as { object?: Record<string, unknown> } | undefined)?.object ?? {};
  // checkout.session objects expose amount_total; payment_intent objects expose amount + currency.
  const amount = Number((object.amount_total as number | undefined) ?? (object.amount as number | undefined) ?? 0);
  const currency = (object.currency as string | null)?.toUpperCase() ?? null;
  return { amount: Number.isFinite(amount) && amount > 0 ? amount : null, currency };
}

async function handleStripeWebhook(event: Record<string, unknown>, supabase: Db): Promise<Response> {
  const eventId = String(event.id ?? '');
  const eventType = String(event.type ?? '');

  // Duplicate-event protection: unique (provider, event_id). A replay loses
  // the insert race and is dropped before any side effects.
  const { data: claimed, error: claimError } = await supabase
    .from('subscription_webhook_events')
    .insert({ provider: STRIPE_PROVIDER, event_id: eventId, event_type: eventType })
    .select('id');
  if (claimError) {
    if ((claimError as { code?: string }).code === '23505') return json({ received: true, duplicate: true });
    throw claimError;
  }
  if (!claimed || claimed.length === 0) return json({ received: true, duplicate: true });

  const succeeded = extractSucceeded(event);
  const failed = [
    'checkout.session.async_payment_failed',
    'payment_intent.payment_failed',
  ].includes(eventType);

  const stripeBillingTypes = [
    'invoice.paid',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
    'invoice.payment_action_required',
    'customer.subscription.updated',
    'customer.subscription.deleted',
  ];
  if (stripeBillingTypes.includes(eventType)) {
    return handleStripeBillingWebhook(event, supabase);
  }

  if (!succeeded && !failed) {
    // Other lifecycle events are recorded but require no action.
    return json({ received: true, ignored: eventType });
  }

  const meta = getCheckoutMeta(event);
  if (!meta) {
    // Charges created outside Checkout (none remain in the Option A
    // architecture) are not processed here.
    return json({ received: true, no_metadata: true });
  }

  const { amount, currency } = getAmountFromEvent(event);

  if (meta.kind === 'subscription') {
    // Initial subscription purchase. On success: create or reset the
    // host_subscriptions row and allocate cycle-1 credits through the REAL
    // activation path. On failure: mark payment_failed without allocating.
    const { data: pkg } = await supabase
      .from('subscription_packages')
      .select('id, code, price_cents')
      .eq('code', meta.package_code)
      .maybeSingle();
    if (!pkg) return json({ received: true, error: 'Unknown package.' }, 400);

    const { data: existing } = await supabase
      .from('host_subscriptions')
      .select('id, status')
      .eq('restaurant_id', meta.restaurant_id)
      .maybeSingle();
    if (existing && (existing as { status: string }).status === 'active') {
      return json({ received: true, already_active: true });
    }

    const { data: emailData } = await supabase.auth.getUser((await getBearerToken(new Request('https://x'))) ?? '');
    void emailData; // not available in webhook context; the customer id comes from the session object

    const sessionObject = (event.data as { object?: Record<string, unknown> }).object ?? {};
    const customerId = (sessionObject.customer as string | null) ?? null;
    const subscriptionId = (sessionObject.subscription as string | null) ?? null;

    if (failed) {
      if (existing) {
        await supabase
          .from('host_subscriptions')
          .update({ status: 'payment_failed', updated_at: new Date().toISOString() })
          .eq('id', (existing as { id: string }).id);
      }
      return json({ received: true });
    }

    // Record the customer id on the subscription row and reset any stale
    // state from the replaced record (old schedule, cancellation, expiry) so
    // the new purchase starts clean — mirroring the test-mode reset.
    if (existing) {
      await supabase
        .from('host_subscriptions')
        .update({
          status: 'incomplete',
          package_id: (pkg as { id: string }).id,
          scheduled_package_id: null,
          auto_renew: true,
          cancel_at_period_end: false,
          canceled_at: null,
          expired_at: null,
          provider: STRIPE_PROVIDER,
          provider_subscription_ref: subscriptionId,
          provider_customer_ref: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', (existing as { id: string }).id);
    } else {
      await supabase.from('host_subscriptions').insert({
        restaurant_id: meta.restaurant_id,
        package_id: (pkg as { id: string }).id,
        status: 'incomplete',
        provider: STRIPE_PROVIDER,
        provider_subscription_ref: subscriptionId,
        provider_customer_ref: customerId,
        billing_anchor_day: new Date().getUTCDate(),
        period_start: new Date().toISOString(),
      });
    }

    if (amount === null) {
      console.error('Stripe webhook succeeded without a usable amount', { eventId, eventType });
      return json({ received: true, error: 'Missing amount.' }, 400);
    }

    const { data: alloc, error: allocError } = await supabase.rpc('allocate_subscription_credits', {
      p_restaurant_id: meta.restaurant_id,
      p_package_id: (pkg as { id: string }).id,
      p_cycle_number: 1,
      p_provider_payment_ref: `pi_${customerId ?? 'cs'}_1_${eventId}`,
      // The charged total already includes VAT; record the exact split.
      p_vat_cents: amount !== null ? Math.round(amount / 5) : null,
      p_total_cents: amount,
    });
    if (allocError) throw allocError;
    void currency;
    return json({ received: true, allocated: (alloc as [boolean, unknown, unknown] | null)?.[0] ?? false });
  }

  if (meta.kind === 'topup') {
    // One-off credit top-up. On success: idempotent allocation through the
    // REAL allocate_topup_credits path. On failure: record failed without
    // allocating.
    const { data: pkg } = await supabase
      .from('credit_topup_packages')
      .select('id, credits, price_cents')
      .eq('code', meta.package_code)
      .maybeSingle();
    if (!pkg) return json({ received: true, error: 'Unknown package.' }, 400);

    if (failed) {
      await supabase.from('credit_topup_payments').insert({
        restaurant_id: meta.restaurant_id,
        package_id: (pkg as { id: string }).id,
        credits: (pkg as { credits: string }).credits,
        amount_cents: amount ?? 0,
        currency: currency ?? 'SEK',
        status: 'failed',
        provider: STRIPE_PROVIDER,
        provider_payment_ref: `evt_${eventId}`,
      });
      return json({ received: true });
    }

    if (amount === null) {
      console.error('Stripe top-up webhook succeeded without a usable amount', { eventId, eventType });
      return json({ received: true, error: 'Missing amount.' }, 400);
    }

    const { data: alloc, error: allocError } = await supabase.rpc('allocate_topup_credits', {
      p_restaurant_id: meta.restaurant_id,
      p_package_id: (pkg as { id: string }).id,
      p_provider: STRIPE_PROVIDER,
      p_provider_payment_ref: `evt_topup_${eventId}`,
      // The charged total already includes VAT; record the exact split.
      p_vat_cents: amount !== null ? Math.round(amount / 5) : null,
      p_total_cents: amount,
    });
    if (allocError) throw allocError;
    return json({ received: true, allocated: (alloc as [boolean, unknown] | null)?.[0] ?? false });
  }

  return json({ received: true, unknown_kind: true });
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
      // Stripe-specific handling: raw-body signature verification, then typed
      // processing against the existing allocation RPCs. The generic adapter
      // path below is retained for other providers.
      const stripeEvent = await verifyStripeWebhook(req).catch(() => null);
      if (stripeEvent) {
        return handleStripeWebhook(stripeEvent, supabase);
      }
      // Stripe IS configured but the signature check failed — never fall
      // through to the generic path, reject immediately.
      if (stripeConfigured()) {
        return json({ error: 'Invalid webhook payload.' }, 400);
      }
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

    // ── Expiry sweep (Stripe-managed renewals) ──
    // Stripe owns recurring charging and reports renewals through webhooks.
    // This route no longer charges anyone; it only expires subscriptions whose
    // period has ended (e.g. renewals Stripe could not complete).
    if (route === 'process-renewals') {
      // Secret resolution: prefer the edge function secret; fall back to the
      // Vault secret the pg_cron scheduler reads (both must hold the same
      // value). Never exposed to the frontend.
      let schedulerSecret = Deno.env.get('SCHEDULED_RENEWAL_SECRET');
      if (!schedulerSecret) {
        const { data: secretData, error: secretError } = await supabase.rpc('get_renewal_scheduler_secret');
        if (secretError) throw secretError;
        schedulerSecret = (secretData as unknown as string | null) ?? null;
      }
      if (!schedulerSecret) {
        return json({ error: 'Renewal scheduling is not configured (SCHEDULED_RENEWAL_SECRET missing).' }, 503);
      }
      const header = req.headers.get('Authorization') ?? '';
      if (header !== `Bearer ${schedulerSecret}`) {
        return json({ error: 'Unauthorized.' }, 401);
      }

      const expired = await supabase.rpc('expire_due_subscriptions');
      if (expired.error) throw expired.error;

      return json({ expiredCount: expired.data ?? 0, processed: 0, results: [] });
    }

    // Shared body/action parse — every route below is JSON POST traffic.
    const body = await req.json().catch(() => null);
    const action = body?.action as string | undefined;

    // ── Checkout routes (authenticated host → Stripe Checkout) ──
    // Both return { url } for the browser to redirect to. Payment
    // confirmation happens exclusively via webhook — nothing here marks a
    // payment successful.

    if (action === 'createSubscriptionCheckout') {
      const adapter = getAdapter();
      if (!adapter) return json({ error: 'Payment provider is not configured.' }, 503);

      const packageCode = String(body?.packageCode ?? '');
      const { data: pkg, error: pkgError } = await supabase
        .from('subscription_packages')
        .select('id, code, name, price_cents')
        .eq('code', packageCode)
        .eq('is_active', true)
        .maybeSingle();
      if (pkgError) throw pkgError;
      if (!pkg) return json({ error: 'That package is not available.' }, 400);

      // One Stripe price per package code, created out-of-band and mapped in
      // stripe_price_map. Without a mapped price we cannot start checkout.
      const { data: priceRow, error: priceError } = await supabase
        .from('stripe_price_map')
        .select('stripe_price_id')
        .eq('package_code', packageCode)
        .eq('kind', 'subscription')
        .maybeSingle();
      if (priceError) throw priceError;
      const priceId = (priceRow as { stripe_price_id: string } | null)?.stripe_price_id;
      if (!priceId) return json({ error: 'No Stripe price is mapped for this package. Run the price sync first.' }, 503);

      const hostUserId = await verifyUser(supabase, req);
      if (!hostUserId) return json({ error: 'Please sign in to continue.' }, 401);
      const restaurantId = await getOwnedRestaurant(supabase, hostUserId);
      if (!restaurantId) return json({ error: 'This account does not own a restaurant portal.' }, 403);

      const { data: emailData } = await supabase.auth.getUser((await getBearerToken(req)) ?? '');
      const hostEmail = (emailData?.user?.email ?? '').trim();
      if (!hostEmail) return json({ error: 'A signed-in account with an email is required.' }, 400);

      const origin = getOrigin(req);
      const session = await createSubscriptionCheckout({
        priceId,
        customerEmail: hostEmail,
        successUrl: `${origin}/?checkout=success`,
        cancelUrl: `${origin}/?checkout=cancelled`,
        metadata: {
          kind: 'subscription',
          restaurant_id: restaurantId,
          package_code: packageCode,
        },
      });
      return json({ ok: true, url: session.url });
    }

    if (action === 'createTopupCheckout') {
      const adapter = getAdapter();
      if (!adapter) return json({ error: 'Payment provider is not configured.' }, 503);

      const packageCode = String(body?.packageCode ?? '');
      const { data: pkg, error: pkgError } = await supabase
        .from('credit_topup_packages')
        .select('id, code, name, price_cents')
        .eq('code', packageCode)
        .eq('is_active', true)
        .maybeSingle();
      if (pkgError) throw pkgError;
      if (!pkg) return json({ error: 'That top-up package is not available.' }, 400);

      const { data: priceRow, error: priceError } = await supabase
        .from('stripe_price_map')
        .select('stripe_price_id')
        .eq('package_code', packageCode)
        .eq('kind', 'topup')
        .maybeSingle();
      if (priceError) throw priceError;
      const priceId = (priceRow as { stripe_price_id: string } | null)?.stripe_price_id;
      if (!priceId) return json({ error: 'No Stripe price is mapped for this package. Run the price sync first.' }, 503);

      const hostUserId = await verifyUser(supabase, req);
      if (!hostUserId) return json({ error: 'Please sign in to continue.' }, 401);
      const restaurantId = await getOwnedRestaurant(supabase, hostUserId);
      if (!restaurantId) return json({ error: 'This account does not own a restaurant portal.' }, 403);

      const { data: emailData } = await supabase.auth.getUser((await getBearerToken(req)) ?? '');
      const hostEmail = (emailData?.user?.email ?? '').trim();
      if (!hostEmail) return json({ error: 'A signed-in account with an email is required.' }, 400);

      const origin = getOrigin(req);
      const session = await createTopupCheckout({
        priceId,
        customerEmail: hostEmail,
        successUrl: `${origin}/?checkout=success`,
        cancelUrl: `${origin}/?checkout=cancelled`,
        metadata: {
          kind: 'topup',
          restaurant_id: restaurantId,
          package_code: packageCode,
        },
      });
      return json({ ok: true, url: session.url });
    }

    // ── One-time price sync: creates Stripe Products + Prices for every
    // active package and stores the id mapping. Protected by
    // STRIPE_PRICE_SYNC_SECRET passed as a bearer token.
    if (route === 'sync-stripe-prices') {
      // Secret resolution: prefer the edge function secret; fall back to the
      // Vault entry the operator can rotate. Never exposed to the frontend.
      let syncSecret = Deno.env.get('STRIPE_PRICE_SYNC_SECRET');
      if (!syncSecret) {
        const { data: vaultRows, error: vaultError } = await supabase.rpc('get_stripe_price_sync_secret');
        if (vaultError) throw vaultError;
        syncSecret = (vaultRows as unknown as string | null) ?? null;
      }
      if (!syncSecret) {
        return json({ error: 'Price sync is not configured (STRIPE_PRICE_SYNC_SECRET missing).' }, 503);
      }
      const header = req.headers.get('Authorization') ?? '';
      if (header !== `Bearer ${syncSecret}`) {
        return json({ error: 'Unauthorized.' }, 401);
      }
      if (!getStripeSecret()) {
        return json({ error: 'Stripe is not configured (STRIPE_SECRET_KEY missing).' }, 503);
      }

      const { Stripe } = await import('npm:stripe@14.25.0');
      const stripe = new Stripe(getStripeSecret()!, { apiVersion: '2024-04-10' });

      const synced: Array<{ code: string; kind: string; priceId: string }> = [];

      const { data: subPkgs, error: subErr } = await supabase
        .from('subscription_packages')
        .select('code, name, price_cents')
        .eq('is_active', true)
        .order('sort_order');
      if (subErr) throw subErr;
      for (const pkg of (subPkgs ?? []) as Array<{ code: string; name: string; price_cents: number }>) {
        const product = await stripe.products.create({
          name: `Virgo Portals — ${pkg.name} (Subscription)`,
          metadata: { kind: 'subscription', package_code: pkg.code },
        });
        // Stripe charges the VAT-INCLUSIVE total (same 25% rate the UI
        // displays); price_cents in the map stays the VAT-exclusive DB price.
        const vatCents = Math.round(pkg.price_cents * 0.25);
        const grossCents = pkg.price_cents + vatCents;
        const price = await stripe.prices.create({
          product: product.id,
          currency: 'sek',
          unit_amount: grossCents,
          recurring: { interval: 'month' },
          metadata: { kind: 'subscription', package_code: pkg.code },
        });
        const { error: mapError } = await supabase
          .from('stripe_price_map')
          .upsert(
            {
              package_code: pkg.code,
              kind: 'subscription',
              stripe_product_id: product.id,
              stripe_price_id: price.id,
              price_cents: pkg.price_cents,
              vat_cents: vatCents,
              gross_cents: grossCents,
              currency: 'SEK',
            },
            { onConflict: 'package_code,kind' }
          );
        if (mapError) throw mapError;
        synced.push({ code: pkg.code, kind: 'subscription', priceId: price.id, grossCents });
      }

      const { data: topupPkgs, error: topupErr } = await supabase
        .from('credit_topup_packages')
        .select('code, name, price_cents')
        .eq('is_active', true)
        .order('sort_order');
      if (topupErr) throw topupErr;
      for (const pkg of (topupPkgs ?? []) as Array<{ code: string; name: string; price_cents: number }>) {
        const product = await stripe.products.create({
          name: `Virgo Portals — ${pkg.name} (Credit Top-up)`,
          metadata: { kind: 'topup', package_code: pkg.code },
        });
        // VAT-inclusive charge, mirroring the subscription path.
        const vatCents = Math.round(pkg.price_cents * 0.25);
        const grossCents = pkg.price_cents + vatCents;
        const price = await stripe.prices.create({
          product: product.id,
          currency: 'sek',
          unit_amount: grossCents,
          metadata: { kind: 'topup', package_code: pkg.code },
        });
        const { error: mapError } = await supabase
          .from('stripe_price_map')
          .upsert(
            {
              package_code: pkg.code,
              kind: 'topup',
              stripe_product_id: product.id,
              stripe_price_id: price.id,
              price_cents: pkg.price_cents,
              vat_cents: vatCents,
              gross_cents: grossCents,
              currency: 'SEK',
            },
            { onConflict: 'package_code,kind' }
          );
        if (mapError) throw mapError;
        synced.push({ code: pkg.code, kind: 'topup', priceId: price.id, grossCents });
      }

      return json({ ok: true, synced });
    }

    // ── Host + admin routes (authenticated) ──
    const userId = await verifyUser(supabase, req);
    if (!userId) return json({ error: 'Please sign in to continue.' }, 401);

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
        .select('subscription_id, cycle_number, amount_cents, vat_cents, total_cents, currency, status, package_id, provider_payment_ref, provider_invoice_url, paid_at, created_at')
        .order('created_at', { ascending: false });
      if (payError) throw payError;

      const { data: topuppayments, error: topupPayError } = await supabase
        .from('credit_topup_payments')
        .select('restaurant_id, credits, amount_cents, vat_cents, total_cents, currency, status, package_id, provider_payment_ref, provider_invoice_url, paid_at, created_at')
        .order('created_at', { ascending: false });
      if (topupPayError) throw topupPayError;

      const { data: topupNames, error: topupNameError } = await supabase
        .from('credit_topup_packages')
        .select('id, name');
      if (topupNameError) throw topupNameError;
      const topupNameMap = new Map(((topupNames ?? []) as Array<{ id: string; name: string }>).map((t) => [t.id, t.name]));

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
          payments: [
            ...((payments ?? []) as Array<Record<string, unknown>>)
              .filter((p) => p.subscription_id === row.id)
              .map((p) => subPaymentRecord(p, pkgMap.get(p.package_id as string)?.name ?? null)),
            ...((topuppayments ?? []) as Array<Record<string, unknown>>)
              .filter((t) => t.restaurant_id === row.restaurant_id)
              .map((t) => topupPaymentRecord(t, topupNameMap.get(t.package_id as string)?.name ?? null)),
          ].sort((a, b) => (b.createdAt as string).localeCompare(a.createdAt as string)),
        };
      });
      return json({ subscriptions: out });
    }

    // ── Host routes: scoped to the caller's own restaurant ──
    const restaurantId = await getOwnedRestaurant(supabase, userId);
    if (!restaurantId) return json({ error: 'This account does not own a restaurant portal.' }, 403);

    if (action === 'getSubscription') {
      const [{ data: packages, error: pkgError }, { data: sub, error: subError }, { data: topupPkgs, error: topupPkgError }] = await Promise.all([
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
        supabase.from('credit_topup_packages').select('id, code, name, credits, price_cents, sort_order').eq('is_active', true).order('sort_order'),
      ]);
      if (pkgError) throw pkgError;
      if (subError) throw subError;
      if (topupPkgError) throw topupPkgError;

      const { data: balanceData, error: balanceError } = await supabase.rpc('check_host_credit', {
        p_restaurant_id: restaurantId,
      });
      if (balanceError) throw balanceError;

      const topupPackages = ((topupPkgs ?? []) as TopupPackageRow[]).map(toPublicTopupPackage);
      const canPurchase = await canPurchaseTopup(supabase, restaurantId);

      const subRow = (sub ?? null) as Record<string, unknown> | null;
      const subId = subRow?.id as string | undefined;

      // Unified, chronologically-ordered payment history across subscription
      // cycles and credit top-ups (top-ups are scoped to restaurant, not cycle).
      const [subPayRes, topupPayRes, topupPkgNameRes] = await Promise.all([
        subId
          ? supabase
              .from('subscription_payments')
              .select('cycle_number, amount_cents, vat_cents, total_cents, currency, status, package_id, provider, provider_payment_ref, provider_invoice_url, paid_at, created_at')
              .eq('subscription_id', subId)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('credit_topup_payments')
          .select('credits, amount_cents, currency, status, package_id, provider, provider_payment_ref, provider_invoice_url, paid_at, created_at')
          .eq('restaurant_id', restaurantId),
        supabase.from('credit_topup_packages').select('id, name'),
      ]);
      if (subPayRes.error) throw subPayRes.error;
      if (topupPayRes.error) throw topupPayRes.error;
      if (topupPkgNameRes.error) throw topupPkgNameRes.error;

      const pkgCodeMap = new Map(((packages ?? []) as Array<{ id: string; name: string }>).map((p) => [p.id, p]));
      const topupNameMap = new Map(
        ((topupPkgNameRes.data ?? []) as Array<{ id: string; name: string }>).map((t) => [t.id, t.name])
      );

      const payments: Array<Record<string, unknown>> = [
        ...((subPayRes.data ?? []) as Array<Record<string, unknown>>).map((p) =>
          subPaymentRecord(p, pkgCodeMap.get(p.package_id as string)?.name ?? null)
        ),
        ...((topupPayRes.data ?? []) as Array<Record<string, unknown>>).map((t) =>
          topupPaymentRecord(t, topupNameMap.get(t.package_id as string)?.name ?? null)
        ),
      ].sort((a, b) => {
        const aTime = (a.createdAt as string) ?? '';
        const bTime = (b.createdAt as string) ?? '';
        return bTime.localeCompare(aTime);
      });

      return json({
        packages: ((packages ?? []) as PackageRow[]).map(toPublicPackage),
        topupPackages,
        canPurchaseTopup: canPurchase,
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
        payments,
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

      // Scheduling only applies to an active paid subscription whose period
      // has not ended. Without one the host must buy through checkout instead.
      const { data: sub, error: subError } = await supabase
        .from('host_subscriptions')
        .select('id, status, period_end')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (subError) throw subError;
      const subRow = sub as { id: string; status: string; period_end: string | null } | null;
      if (!subRow) return json({ error: 'No subscription to change.' }, 400);
      const periodEnded = Boolean(subRow.period_end && subRow.period_end <= new Date().toISOString());
      if (subRow.status !== 'active' || periodEnded) {
        return json({ error: 'An active paid subscription is required to schedule a package change. Purchase a package instead.' }, 400);
      }

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

    if (action === 'testCheckout' || action === 'testRenewal' || action === 'testExpireNow' || action === 'testTopUp') {
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

    if (action === 'testTopUp') {
      // Simulated one-off top-up purchase. Reuses the mock test provider and
      // test_-prefixed refs, and drives the REAL allocate_topup_credits path
      // (same eligibility + idempotency + wallet integration as production).
      const packageCode = String(body?.packageCode ?? '');

      const { data: pkg, error: pkgError } = await supabase
        .from('credit_topup_packages')
        .select('id, code, credits, price_cents')
        .eq('code', packageCode)
        .eq('is_active', true)
        .maybeSingle();
      if (pkgError) throw pkgError;
      if (!pkg) return json({ error: 'That top-up package is not available.' }, 400);

      const ref = `test_topup_${crypto.randomUUID()}`;
      const { data: alloc, error: allocError } = await supabase.rpc('allocate_topup_credits', {
        p_restaurant_id: restaurantId,
        p_package_id: (pkg as { id: string }).id,
        p_provider: TEST_PROVIDER,
        p_provider_payment_ref: ref,
      });
      if (allocError) {
        return json({ error: allocError.message }, 400);
      }
      const [allocated, newBalance] = alloc as [boolean, string];
      if (!allocated) {
        return json({ ok: false, simulated: 'duplicate', message: 'This payment was already processed.' });
      }
      return json({
        ok: true,
        simulated: 'succeeded',
        balance: Number(newBalance),
        credits: Number((pkg as { credits: string }).credits),
        testRef: ref,
      });
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
