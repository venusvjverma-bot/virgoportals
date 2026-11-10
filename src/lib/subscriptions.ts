import { callFunction } from '@/lib/functions';

export interface SubscriptionPackage {
  id: string;
  code: string;
  name: string;
  priceCents: number;
  credits: number;
  sortOrder: number;
}

export interface SubscriptionPayment {
  cycleNumber: number;
  amountCents: number;
  status: 'pending' | 'succeeded' | 'failed';
  packageName?: string | null;
  paymentRef: string | null;
  invoiceUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

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
  subscription: HostSubscription | null;
  balance: number;
  payments: SubscriptionPayment[];
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
  payments: SubscriptionPayment[];
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
  periodEnd?: string;
  expiredCount?: number;
  message?: string;
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
