/**
 * Stripe payment adapter for the subscription-api edge function.
 *
 * - verifyStripeWebhook: Stripe signature verification (STRIPE_WEBHOOK_SECRET)
 * - createSubscriptionCheckout / createTopupCheckout: Checkout Sessions
 *
 * Recurring renewals are charged by Stripe itself (subscription billing);
 * outcomes arrive as webhooks — there is no off-session charging here.
 *
 * Secrets (edge function secrets, never frontend):
 * - STRIPE_SECRET_KEY
 * - STRIPE_WEBHOOK_SECRET
 */
// @ts-nocheck -- Deno npm: specifier types are not resolvable by the web build's type check; syntax is validated by esbuild + deploy.

import Stripe from 'npm:stripe@14.25.0';

export function getStripeSecret(): string | null {
  return Deno.env.get('STRIPE_SECRET_KEY') ?? null;
}

export function getStripeWebhookSecret(): string | null {
  return Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? null;
}

let stripeClient: Stripe | null = null;
function client(): Stripe {
  const key = getStripeSecret();
  if (!key) throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing).');
  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      // Pin the API version so webhook event shapes stay stable.
      apiVersion: '2024-04-10',
    });
  }
  return stripeClient;
}

export function stripeConfigured(): boolean {
  return Boolean(getStripeSecret() && getStripeWebhookSecret());
}

// ── Webhook verification ────────────────────────────────────────────────────

export interface ParsedWebhook {
  event: { id: string; type: string; data: { object: Record<string, unknown> } };
}

// Deno cannot use the Node crypto path behind the sync constructEvent call;
// Supabase edge functions must verify with the async SubtleCrypto provider.
const cryptoProvider = Stripe.createSubtleCryptoProvider();

export async function verifyStripeWebhook(req: Request): Promise<Record<string, unknown> | null> {
  const secret = (getStripeWebhookSecret() ?? '').trim();
  if (!secret) return null;
  const signature = (req.headers.get('stripe-signature') ?? '').trim();
  if (!signature) return null;
  const payload = await req.text();
  try {
    const event = await client().webhooks.constructEventAsync(payload, signature, secret, undefined, cryptoProvider);
    return event as unknown as Record<string, unknown>;
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', (err as Error)?.message ?? err);
    throw err;
  }
}

// ── Checkout (initial subscription / top-up) ────────────────────────────────

export async function createSubscriptionCheckout(args: {
  priceId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<{ id: string; url: string | null }> {
  const session = await client().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: args.priceId, quantity: 1 }],
    customer_email: args.customerEmail,
    success_url: args.successUrl,
    cancel_url: args.cancel_url ?? args.cancelUrl,
    // setup_future_usage is not valid in subscription mode — Stripe saves the
    // payment method to the customer automatically, so renewals can charge
    // off-session without it.
    metadata: args.metadata,
  });
  return { id: session.id, url: session.url };
}

export async function createTopupCheckout(args: {
  priceId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<{ id: string; url: string | null }> {
  const session = await client().checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: args.priceId, quantity: 1 }],
    customer_email: helpers_customerEmail(args.customerEmail),
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    metadata: args.metadata,
  });
  return { id: session.id, url: session.url };
}

function helpers_customerEmail(email: string): string {
  return email;
}
