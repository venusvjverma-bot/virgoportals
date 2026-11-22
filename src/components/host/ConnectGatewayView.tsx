import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, ExternalLink, Landmark, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import {
  consumeConnectParam,
  getConnectStatus,
  startConnectOnboarding,
  type ConnectAccountStatus,
  type ConnectStatus,
} from '@/lib/connectGateway';
import type { RestaurantPortal } from '@/types';

interface StatusContent {
  label: string;
  tone: 'success' | 'info' | 'error';
  badgeClass: string;
  title: string;
  description: string;
  actionLabel: string | null;
}

const STATUS_CONTENT: Record<ConnectStatus, StatusContent> = {
  not_connected: {
    label: 'Not Connected',
    tone: 'info',
    badgeClass: 'bg-cream-200 text-ink-muted',
    title: 'Stripe is not connected yet',
    description:
      'Your portal is not linked to a Stripe account, so there is nowhere to receive payouts yet. Connect Stripe to get started — it only takes a few minutes.',
    actionLabel: 'Connect with Stripe',
  },
  setup_required: {
    label: 'Setup Required',
    tone: 'info',
    badgeClass: 'bg-cream-200 text-ink-muted',
    title: 'Finish setting up Stripe',
    description:
      'A Stripe account has been prepared for your restaurant, but Stripe still needs a few details from you before payouts can begin.',
    actionLabel: 'Continue Stripe Setup',
  },
  pending_verification: {
    label: 'Pending Verification',
    tone: 'info',
    badgeClass: 'bg-olive-50 text-olive-800',
    title: 'Stripe is reviewing your information',
    description:
      'Your details have been submitted and Stripe is verifying them. This can take a little while — this page updates automatically once Stripe confirms the result.',
    actionLabel: null,
  },
  connected: {
    label: 'Connected',
    tone: 'success',
    badgeClass: 'bg-success-50 text-success-700',
    title: 'Stripe is connected',
    description:
      'Stripe has confirmed the required recipient capability and that your account is ready to receive payouts, according to the latest synchronized account status.',
    actionLabel: null,
  },
  action_required: {
    label: 'Action Required',
    tone: 'error',
    badgeClass: 'bg-error-50 text-error-700',
    title: 'Stripe needs something from you',
    description:
      'Stripe requires additional information or action before payouts can continue. Continue the setup to see exactly what Stripe needs.',
    actionLabel: 'Continue in Stripe',
  },
};

export function ConnectGatewayView(_props: { restaurant: RestaurantPortal }) {
  const [status, setStatus] = useState<ConnectAccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnedFromStripe, setReturnedFromStripe] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const found = await getConnectStatus();
      setStatus(found);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your connection status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Returning from Stripe never proves onboarding finished — show the last
    // known status and let the webhook synchronization correct it later.
    if (consumeConnectParam()) {
      setReturnedFromStripe(true);
    }
    loadStatus();
  }, [loadStatus]);

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const onboardingUrl = await startConnectOnboarding();
      if (onboardingUrl) {
        window.location.href = onboardingUrl;
        return;
      }
      // No onboarding link means the account is already fully connected.
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the Stripe connection. Please try again.');
    } finally {
      setConnecting(false);
    }
  }

  const content = status ? STATUS_CONTENT[status.status] : null;

  return (
    <div className="space-y-5">
      {returnedFromStripe ? (
        <Notice tone="info">
          Welcome back from Stripe. Your connection status below shows the latest verified state — Stripe
          may still be finishing its review, and the status updates here automatically when Stripe reports
          the result.
        </Notice>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}

      <section className="rounded-[22px] bg-white p-5 shadow-soft ring-1 ring-cream-200 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-olive-700">
            <Landmark className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold text-ink">Connection status</h2>
            <p className="mt-1 text-sm text-ink-muted">
              How {`your restaurant`}'s payouts are connected through Stripe.
            </p>
          </div>
          <button
            type="button"
            onClick={loadStatus}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:bg-cream-50 hover:text-ink"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="mt-5 flex items-center gap-2 text-sm text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin text-olive-600" />
            Checking your connection…
          </div>
        ) : content && status ? (
          <div className="mt-5">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${content.badgeClass}`}>
              {content.label}
            </span>
            <div className="mt-3 flex items-start gap-2.5">
              {status.status === 'connected' ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-600" />
              ) : status.status === 'pending_verification' ? (
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-olive-600" />
              ) : status.status === 'action_required' ? (
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-error-500" />
              ) : (
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-olive-600" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{content.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{content.description}</p>
                {status.status === 'connected' && status.payoutsEnabled === false ? (
                  <p className="mt-2 text-sm text-ink-muted">
                    Payouts to your bank are not active yet — Stripe will guide you through the remaining
                    step in its dashboard.
                  </p>
                ) : null}
              </div>
            </div>

            {content.actionLabel ? (
              <div className="mt-5">
                <Button onClick={handleConnect} disabled={connecting}>
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  {connecting ? 'Opening Stripe…' : content.actionLabel}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          !error ? (
            <p className="mt-5 rounded-xl bg-cream-50 px-4 py-4 text-sm text-ink-muted">
              Connection status is unavailable right now.
            </p>
          ) : null
        )}
      </section>

      <section className="rounded-[22px] bg-white p-5 shadow-soft ring-1 ring-cream-200 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-olive-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Your details stay with Stripe</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Business verification and bank details for payouts are collected and protected entirely by
              Stripe, on Stripe's own secure pages. Virgo Portals never collects your full bank details —
              we only display your connection status and open Stripe's setup for you.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
