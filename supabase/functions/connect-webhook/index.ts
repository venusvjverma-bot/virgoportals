/**
 * Connect webhook — Stripe Accounts v2 account status synchronisation (Module 3).
 *
 * Receives `v2.core.account.updated` events for recipient accounts created by
 * connect-gateway (Module 2). On a verified event:
 *   1. extract the connected account id from the event envelope,
 *   2. re-fetch the account from Stripe (GET /v2/core/accounts/:id) using the
 *      same v2 Stripe-Version as Module 2, so status always comes from verified
 *      account data — never from event payload fields or browser input,
 *   3. map the real account state onto restaurant_stripe_accounts and update
 *      only the row matched by stripe_account_id.
 *
 * Signature verification uses the standard Stripe scheme (Stripe-Signature:
 * `t=...,v1=...`, HMAC-SHA256 over `${timestamp}.${rawBody}`) with a DEDICATED
 * secret (STRIPE_CONNECT_WEBHOOK_SECRET) — the subscription webhook secret
 * (STRIPE_WEBHOOK_SECRET) is not read here. Implemented directly with
 * SubtleCrypto so this function stays code-independent of subscription-api.
 *
 * Idempotency: deliveries are event-id driven but replaying simply re-fetches
 * and re-applies the same verified account state — the update converges to the
 * same values, so repeats are harmless. No event-log table is required.
 *
 * HTTP contract: 2xx only AFTER the database write succeeds; signature errors
 * are 400 (no retry), transient/database failures are 500 (Stripe retries).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Same version default as connect-gateway; kept in step when overridden.
function stripeV2Version(): string {
  return Deno.env.get('STRIPE_CONNECT_API_VERSION') ?? '2026-10-28.preview';
}

// ── Stripe raw API (GET only here; webhooks never mutate Stripe state) ──────

async function stripeV2Get(path: string): Promise<Record<string, unknown> | null> {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('Stripe is not configured.');
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': stripeV2Version() },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Stripe GET ${path} failed: HTTP ${response.status}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

// ── Signature verification (raw body, dedicated Connect secret) ─────────────

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

async function verifyConnectSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const secret = Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET');
  if (!secret || !signatureHeader) return false;

  const parts = signatureHeader.split(',').map((p) => p.trim().split('=')) as Array<[string, string]>;
  const timestamp = parts.find(([k]) => k === 't')?.[1];
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!timestamp || signatures.length === 0) return false;

  // Reject stale deliveries (> 5 minutes) to prevent replay of captured bodies.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const payload = new TextEncoder().encode(`${timestamp}.${rawBody}`);
  const keyMaterial = new TextEncoder().encode(secret);
  const cryptoKey = await crypto.subtle.importKey('raw', keyMaterial, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, payload));
  const expected = Array.from(mac)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  for (const sig of signatures) {
    if (timingSafeEqual(new TextEncoder().encode(sig), new TextEncoder().encode(expected))) return true;
  }
  return false;
}

// ── Event → account id extraction (v2 envelope, defensively parsed) ─────────
// v2 event envelopes carry the account in related_object.id (documented v2
// shape); fallbacks cover minor envelope variations. Nothing outside the
// verified event is ever trusted.

function extractAccountId(event: Record<string, unknown>): string | null {
  const candidates: unknown[] = [
    (event as { related_object?: { id?: unknown } }).related_object?.id,
    (event as { data?: { object?: { id?: unknown } } }).data?.object?.id,
    (event as { object?: { id?: unknown } }).object?.id,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.startsWith('acct_')) return c;
  }
  return null;
}

// ── Status mapping from the RETRIEVED Accounts v2 account ───────────────────
// Verified fields used (Accounts v2 recipient structure):
//   configuration.recipient.capabilities.stripe_balance.stripe_transfers.status
//     'active' → connection fully usable; 'requested'/'pending' → verification
//     in progress; 'restricted'/other → needs attention.
//   configuration.recipient.requirements.currently_due / past_due /
//     disabled_reasons (arrays), plus any account-level disabled_reason.
// Mapping rules (in order):
//   1. past_due non-empty OR disabled_reasons non-empty OR disabled_reason →
//      'action_required'
//   2. capability 'active' AND no pending requirement arrays → 'connected'
//   3. capability 'requested'/'pending' OR currently_due non-empty →
//      'pending_verification'
//   4. otherwise → null (leave the stored status untouched; never guess)
// charges_enabled is NOT applicable to a recipient-only account (v2 exposes no
// such boolean) and is preserved as-is (null). payouts_enabled mirrors the
// transfers capability, which is what pays out to the restaurant.

interface DerivedStatus {
  status: string | null;
  payoutsEnabled: boolean | null;
  disabledReason: string | null;
  requirements: Record<string, unknown>;
}

function readArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

function deriveStatus(account: Record<string, unknown>): DerivedStatus {
  const config = (account.configuration ?? {}) as Record<string, unknown>;
  const recipient = (config.recipient ?? {}) as Record<string, unknown>;
  const capabilities = (recipient.capabilities ?? {}) as Record<string, unknown>;
  const balance = (capabilities.stripe_balance ?? {}) as Record<string, unknown>;
  const transfers = (balance.stripe_transfers ?? {}) as Record<string, unknown>;
  const capStatus = typeof transfers.status === 'string' ? transfers.status : null;

  const reqs = (recipient.requirements ?? {}) as Record<string, unknown>;
  const currentlyDue = readArray(reqs.currently_due);
  const pastDue = readArray(reqs.past_due);
  const disabledReasons = readArray(reqs.disabled_reasons);
  const disabledReason =
    typeof account.disabled_reason === 'string'
      ? account.disabled_reason
      : disabledReasons.length > 0
        ? disabledReasons.join(', ')
        : null;

  const requirements: Record<string, unknown> = { capability_status: capStatus };
  if (Array.isArray(reqs.currently_due)) requirements.currently_due = currentlyDue;
  if (Array.isArray(reqs.past_due)) requirements.past_due = pastDue;
  if (Array.isArray(reqs.disabled_reasons)) requirements.disabled_reasons = disabledReasons;

  let status: string | null = null;
  if (pastDue.length > 0 || disabledReasons.length > 0 || disabledReason) {
    status = 'action_required';
  } else if (capStatus === 'active') {
    status = 'connected';
  } else if (capStatus === 'requested' || capStatus === 'pending' || currentlyDue.length > 0) {
    status = 'pending_verification';
  }

  const payoutsEnabled = capStatus === 'active' ? true : capStatus === null ? null : false;
  return { status, payoutsEnabled, disabledReason, requirements };
}

// ── Main ────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return json({ error: 'Malformed payload.' }, 400);
    }

    const valid = await verifyConnectSignature(rawBody, req.headers.get('stripe-signature'));
    if (!valid) {
      return json({ error: 'Invalid signature.' }, 400);
    }

    const eventId = typeof event.id === 'string' ? event.id : 'unknown';
    const eventType = typeof event.type === 'string' ? event.type : '';
    if (eventType !== 'v2.core.account.updated') {
      // Other event types (e.g. lifecycle notifications) need no action here.
      return json({ received: true, ignored: eventType });
    }

    const accountId = extractAccountId(event);
    if (!accountId) {
      console.error(`connect-webhook ${eventId}: no account id in verified event`);
      return json({ received: true, no_account: true });
    }

    // Status always comes from a fresh retrieval of the account itself.
    const account = await stripeV2Get(`/v2/core/accounts/${accountId}`);
    if (!account) {
      console.warn(`connect-webhook ${eventId}: account ${accountId} not found at Stripe`);
      return json({ received: true, unknown_account: true });
    }

    const derived = deriveStatus(account);

    const { createClient } = await import('npm:@supabase/supabase-js@2.45.4');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: mapping, error: mapError } = await supabase
      .from('restaurant_stripe_accounts')
      .select('id, onboarding_status')
      .eq('stripe_account_id', accountId)
      .maybeSingle();
    if (mapError) throw mapError;
    if (!mapping) {
      // Unknown connected account: log and acknowledge (no retry loop).
      console.warn(`connect-webhook ${eventId}: no mapping for ${accountId}`);
      return json({ received: true, unmapped: true });
    }

    const existing = mapping as { id: string; onboarding_status: string };
    const nextStatus = derived.status ?? existing.onboarding_status;

    const { error: updError } = await supabase
      .from('restaurant_stripe_accounts')
      .update({
        onboarding_status: nextStatus,
        payouts_enabled: derived.payoutsEnabled,
        disabled_reason: derived.disabledReason,
        requirements: derived.requirements,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (updError) throw updError;

    // Acknowledge only after the database write succeeded — Stripe retries on
    // non-2xx, and replaying re-applies the same values safely.
    return json({ received: true, event: eventId, status: nextStatus });
  } catch (err) {
    console.error('connect-webhook error:', err instanceof Error ? err.message : err);
    return json({ error: 'Transient failure.' }, 500);
  }
});
