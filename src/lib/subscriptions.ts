import { callFunction } from '@/lib/functions';

export interface SubscriptionPackage {
  id: string;
  code: string;
  name: string;
  priceCents: number;
  credits: number;
  sortOrder: number;
}

export interface TopupPackage {
  id: string;
  code: string;
  name: string;
  credits: number;
  priceCents: number;
  sortOrder: number;
}

/** Unified payment record: subscription cycle or credit top-up. */
export interface PaymentRecord {
  type: 'subscription' | 'renewal' | 'topup';
  description: string | null;
  credits: number | null;
  cycleNumber: number | null;
  amountCents: number;
  /** ISO currency of this payment as recorded (e.g. 'SEK'; older rows 'USD'). */
  currency: string;
  status: 'pending' | 'succeeded' | 'failed';
  paymentRef: string | null;
  invoiceUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

// Backward-compatible alias for the subscription payments previously used by
// callers that only dealt with subscription cycle rows.
export type SubscriptionPayment = PaymentRecord;

export interface HostSubscription {
  status: 'incomplete' | 'active' | 'payment_failed' | 'canceled' | 'expired';
  packageName: string;
  packageCode: string;
  scheduledPackageName: string | null;
  scheduledPackageCode: string | null;
  autoRenew: boolean;
  periodStart: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  nextRenewal: string | null;
  provider: string | null;
}

export interface SubscriptionOverview {
  packages: SubscriptionPackage[];
  topupPackages: TopupPackage[];
  canPurchaseTopup: boolean;
  subscription: HostSubscription | null;
  balance: number;
  payments: PaymentRecord[];
}

export async function getSubscriptionOverview(): Promise<SubscriptionOverview> {
  return callFunction<SubscriptionOverview>('subscription-api', { action: 'getSubscription' });
}

export async function setAutoRenew(value: boolean): Promise<void> {
  await callFunction('subscription-api', { action: 'setAutoRenew', value });
}

export async function changeScheduledPackage(packageCode: string): Promise<void> {
  await callFunction('subscription-api', { action: 'changePackage', packageCode });
}

export async function cancelSubscription(): Promise<void> {
  await callFunction('subscription-api', { action: 'cancelSubscription' });
}

/** Starts Stripe Checkout for an initial subscription purchase. Returns the redirect URL. */
export async function startSubscriptionCheckout(packageCode: string): Promise<string> {
  const result = await callFunction<{ url: string }>('subscription-api', {
    action: 'createSubscriptionCheckout',
    packageCode,
  });
  return result.url;
}

/** Starts Stripe Checkout for a one-off credit top-up. Returns the redirect URL. */
export async function startTopupCheckout(packageCode: string): Promise<string> {
  const result = await callFunction<{ url: string }>('subscription-api', {
    action: 'createTopupCheckout',
    packageCode,
  });
  return result.url;
}

export interface AdminSubscriptionRow {
  subscriptionId: string;
  ownerId: string;
  ownerEmail: string;
  restaurantName: string;
  packageCode: string;
  packageName: string;
  scheduledPackageCode: string | null;
  scheduledPackageName: string | null;
  status: HostSubscription['status'];
  autoRenew: boolean;
  periodStart: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  nextRenewal: string | null;
  balance: number;
  payments: PaymentRecord[];
}

export async function adminListSubscriptions(): Promise<AdminSubscriptionRow[]> {
  const result = await callFunction<{ subscriptions: AdminSubscriptionRow[] }>('subscription-api', {
    action: 'adminListSubscriptions',
  });
  return result.subscriptions;
}

// ── TEST-MODE ONLY (secret-gated; secret is never exposed to the frontend) ──
// The test secret is prompted from the operator at runtime and sent to the
// server, which validates it against SUBSCRIPTION_TEST_MODE_SECRET.

export interface TestModeResult {
  ok: boolean;
  simulated: string;
  balance?: number;
  cycle?: number;
  credits?: number;
  periodEnd?: string;
  expiredCount?: number;
  message?: string;
  testRef?: string;
}

export async function testCheckout(packageCode: string, testSecret: string, fail = false): Promise<TestModeResult> {
  return callFunction<TestModeResult>('subscription-api', { action: 'testCheckout', packageCode, testSecret, fail });
}

export async function testRenewal(testSecret: string, opts: { fail?: boolean; forceDue?: boolean } = {}): Promise<TestModeResult> {
  return callFunction<TestModeResult>('subscription-api', { action: 'testRenewal', testSecret, ...opts });
}

export async function testExpireNow(testSecret: string): Promise<TestModeResult> {
  return callFunction<TestModeResult>('subscription-api', { action: 'testExpireNow', testSecret });
}

export async function testTopUp(packageCode: string, testSecret: string): Promise<TestModeResult> {
  return callFunction<TestModeResult>('subscription-api', { action: 'testTopUp', packageCode, testSecret });
}
