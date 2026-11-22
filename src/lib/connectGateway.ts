import { callFunction } from '@/lib/functions';
import { supabase } from '@/lib/supabase';

export type ConnectStatus =
  | 'not_connected'
  | 'setup_required'
  | 'pending_verification'
  | 'connected'
  | 'action_required';

export interface ConnectAccountStatus {
  status: ConnectStatus;
  payoutsEnabled: boolean | null;
  updatedAt: string | null;
}

/** Response contract of the connect-gateway edge function (Module 2). */
interface ConnectGatewayResponse {
  connected?: boolean;
  status?: string;
  onboardingUrl?: string | null;
}

/** Reads the host's own status row — scoped by RLS, no restaurant id is sent. */
export async function getConnectStatus(): Promise<ConnectAccountStatus> {
  const { data, error } = await supabase
    .from('restaurant_stripe_accounts')
    .select('onboarding_status, payouts_enabled, updated_at')
    .maybeSingle();
  if (error) throw error;
  if (!data) return { status: 'not_connected', payoutsEnabled: null, updatedAt: null };
  const row = data as { onboarding_status: string; payouts_enabled: boolean | null; updated_at: string | null };
  return {
    status: row.onboarding_status as ConnectStatus,
    payoutsEnabled: row.payouts_enabled,
    updatedAt: row.updated_at,
  };
}

/**
 * Asks the backend for a Stripe-hosted onboarding link. The backend reuses the
 * existing connected account when one exists, so this never creates a second
 * account. Returns null when the account is already fully connected.
 */
export async function startConnectOnboarding(): Promise<string | null> {
  const response = await callFunction<ConnectGatewayResponse>('connect-gateway', {});
  return response.onboardingUrl ?? null;
}

/**
 * Detects `?connect=return` / `?connect=refresh` after Stripe redirects back,
 * removes the parameter from the address bar, and reports what was seen.
 */
export function consumeConnectParam(): 'return' | 'refresh' | null {
  const params = new URLSearchParams(window.location.search);
  const value = params.get('connect');
  if (value !== 'return' && value !== 'refresh') return null;
  params.delete('connect');
  const query = params.toString();
  const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  window.history.replaceState(window.history.state, '', next);
  return value;
}
