// TEMPORARY test/verification helper for the Option A renewal rollout.
// Every action is allowlisted to the two migration/test customers. Deleted
// after verification. Actions (POST JSON):
// - find-subscription { customerId }         → native Stripe subscription ids
// - reset-anchor { customerId, paymentMethod? } → billing_cycle_anchor: 'now'
//   (forces Stripe to issue + charge a real renewal invoice now), optionally
//   with a different default payment method (declined-card scenario)
// - latest-invoice { customerId }            → subscription's latest invoice state
// - events { customerId }                    → recent invoice/subscription events
// - replay-webhook { eventId, times? }       → fetch the event from Stripe,
//   sign it with STRIPE_WEBHOOK_SECRET and POST it to our webhook route
//   `times` times (default 2) to prove duplicate delivery is dropped.

import Stripe from 'npm:stripe@14.25.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const ALLOWED_CUSTOMERS = new Set(['cus_Velf26HNgJOzkS', 'cus_VemP7EsTVMXmP7']);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  let probeSecret = Deno.env.get('PROBE_SECRET') ?? null;
  if (!probeSecret) {
    // Fall back to the Vault secret seeded by the test harness (service-role
    // access only); the runtime env secret is preferred when present.
    try {
      const { createClient } = await import('npm:@supabase/supabase-js@2.45.4');
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data, error } = await admin.rpc('get_probe_secret');
      if (error) console.error('get_probe_secret rpc error:', JSON.stringify(error));
      probeSecret = (data as unknown as string | null) ?? null;
    } catch (e) {
      console.error('probe secret fallback failed:', e instanceof Error ? e.message : e);
    }
  }
  const auth = req.headers.get('Authorization') ?? '';
  if (!probeSecret) return json({ error: 'Probe secret is not configured.' }, 503);
  if (auth !== `Bearer ${probeSecret}`) return json({ error: 'Unauthorized.', resolved: true }, 401);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) return json({ error: 'Stripe is not configured.' }, 503);
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-04-10' });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? '');
  const customerId = String(body?.customerId ?? '');
  if (['find-subscription', 'reset-anchor', 'latest-invoice', 'events'].includes(action) && !ALLOWED_CUSTOMERS.has(customerId)) {
    return json({ error: 'customer not allowlisted.' }, 403);
  }

  try {
    if (action === 'find-subscription') {
      const subs = await stripe.subscriptions.list({ customer: customerId, limit: 10 });
      return json({
        ok: true,
        subscriptions: subs.data.map((s) => ({
          id: s.id,
          status: s.status,
          current_period_end: s.current_period_end,
          latest_invoice: typeof s.latest_invoice === 'string' ? s.latest_invoice : s.latest_invoice?.id ?? null,
          default_payment_method: s.default_payment_method,
        })),
      });
    }

    if (action === 'reset-anchor') {
      const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
      const sub = subs.data.find((s) => ['active', 'past_due', 'unpaid'].includes(s.status));
      if (!sub) return json({ error: 'No active subscription for customer.' }, 404);

      const paymentMethod = String(body?.paymentMethod ?? '');
      let attachedPm: string | null = null;
      if (paymentMethod) {
        try {
          await stripe.paymentMethods.attach(paymentMethod, { customer: customerId });
          attachedPm = paymentMethod;
        } catch (err) {
          return json({ ok: false, stage: 'attach', error: err instanceof Error ? err.message : 'attach failed' });
        }
        await stripe.subscriptions.update(sub.id, { default_payment_method: paymentMethod });
      }

      const updated = await stripe.subscriptions.update(sub.id, {
        billing_cycle_anchor: 'now',
        proration_behavior: 'none',
      });
      const inv = typeof updated.latest_invoice === 'string'
        ? await stripe.invoices.retrieve(updated.latest_invoice)
        : updated.latest_invoice
          ? await stripe.invoices.retrieve(updated.latest_invoice.id)
          : null;
      return json({
        ok: true,
        subscription: sub.id,
        period_end: updated.current_period_end,
        latest_invoice: inv ? { id: inv.id, status: inv.status, amount_paid: inv.amount_paid, billing_reason: inv.billing_reason } : null,
        default_payment_method: updated.default_payment_method,
        attachedPm,
      });
    }

    if (action === 'latest-invoice') {
      const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
      const sub = subs.data[0];
      if (!sub) return json({ error: 'No subscription.' }, 404);
      const inv = typeof sub.latest_invoice === 'string'
        ? await stripe.invoices.retrieve(sub.latest_invoice)
        : sub.latest_invoice
          ? await stripe.invoices.retrieve(sub.latest_invoice.id)
          : null;
      return json({
        ok: true,
        subscription: sub.id,
        status: sub.status,
        invoice: inv ? { id: inv.id, status: inv.status, amount_paid: inv.amount_paid, billing_reason: inv.billing_reason, attempt_count: inv.attempt_count } : null,
      });
    }

    if (action === 'events') {
      const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
      const subIds = subs.data.map((s) => s.id);
      const evts = await stripe.events.list({ limit: 50 });
      const rows = evts.data
        .filter((e) => {
          const obj = e.data?.object as { customer?: string; subscription?: string } | undefined;
          return obj && (subIds.includes(String(obj.subscription)) || ALLOWED_CUSTOMERS.has(String(obj.customer)));
        })
        .map((e) => ({ id: e.id, type: e.type, created: e.created }));
      return json({ ok: true, events: rows });
    }

    if (action === 'replay-webhook') {
      const eventId = String(body?.eventId ?? '');
      const times = Math.min(Number(body?.times ?? 2), 3);
      if (!eventId.startsWith('evt_')) return json({ error: 'eventId required.' }, 400);
      const event = await stripe.events.retrieve(eventId);
      const payload = JSON.stringify(event);
      const webhookSecret = (Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '').trim();
      if (!webhookSecret) return json({ error: 'STRIPE_WEBHOOK_SECRET missing.' }, 503);
      const target = `${Deno.env.get('SUPABASE_URL')}/functions/v1/subscription-api/webhook`;
      const responses: Array<{ status: number; body: string }> = [];
      for (let i = 0; i < times; i++) {
        const t = Math.floor(Date.now() / 1000);
        const sig = await hmacSign(webhookSecret, `${t}.${payload}`);
        const res = await fetch(target, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Stripe-Signature': `t=${t},v1=${sig}`,
          },
          body: payload,
        });
        responses.push({ status: res.status, body: await res.text() });
      }
      return json({ ok: true, delivered: responses });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : 'Probe error.' }, 500);
  }
});
