import { supabase } from '@/lib/supabase';
import { adminWhoami } from '@/lib/adminApi';
import type { Session } from '@/types';

/**
 * Reads the persisted session, retrying briefly on a transient failure. A
 * momentary storage or network error must not be mistaken for "signed out",
 * which would drop a still-valid user back to the sign-in screen on an ordinary
 * page load or when returning with the Back button.
 */
async function readStoredSession() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase.auth.getSession();
    if (!error) return data.session;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}

/**
 * Role resolution is server-authoritative:
 * - `admin` is decided by the `admin_users` allowlist, checked by the admin-api
 *   edge function against the verified access token.
 * - `host` is decided by whether the signed-in account owns a restaurant row,
 *   which row level security only returns for the owner.
 * Neither can be set from the browser.
 */
export async function resolveSession(): Promise<Session | null> {
  const stored = await readStoredSession();
  const user = stored?.user;
  if (!user) return null;

  const email = user.email ?? '';

  try {
    if (await adminWhoami()) {
      return { userId: user.id, email, role: 'admin' };
    }
  } catch {
    // A failure here must not grant admin; fall through to the host check.
  }

  const { data: owned } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();

  return { userId: user.id, email, role: owned ? 'host' : 'no-portal' };
}

export async function signIn(email: string, password: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) {
    throw new Error('Enter your email and password to continue.');
  }
  const { error } = await supabase.auth.signInWithPassword({
    email: normalized,
    password,
  });
  if (error) {
    throw new Error('That email or password is not correct.');
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Always resolves without revealing whether the address has an account, so the
 * caller cannot use this screen to enumerate users.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new Error('Enter your email address first.');
  }
  await supabase.auth.resetPasswordForEmail(normalized, {
    redirectTo: `${window.location.origin}${window.location.pathname}`,
  });
}

/**
 * A bounded wait, so a request that never settles surfaces a clear message
 * instead of leaving the "Saving…" state on screen forever.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('That took too long. Check your connection and try again.')),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await withTimeout(
    supabase.auth.updateUser({ password }),
    15000
  );
  if (error) throw new Error(error.message);
}

/** True when the current URL carries a Supabase recovery redirect. */
export function readRecoveryState(): 'recovery' | 'error' | null {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  if (params.get('type') === 'recovery' || params.get('error_code') === 'otp_expired') {
    return params.get('error') ? 'error' : 'recovery';
  }
  if (params.get('error_code')) return 'error';
  return null;
}

export function clearRecoveryHash(): void {
  const url = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  window.history.replaceState({}, '', url);
}

export function onAuthChange(callback: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    (async () => {
      if (!session) {
        callback(null);
        return;
      }
      callback(await resolveSession());
    })();
  });
  return () => data.subscription.unsubscribe();
}
