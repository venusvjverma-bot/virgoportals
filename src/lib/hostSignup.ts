import { callFunction } from '@/lib/functions';
import { supabase } from '@/lib/supabase';

export const MIN_PASSWORD_LENGTH = 8;

export interface HostSignupInput {
  email: string;
  password: string;
  confirmPassword: string;
  restaurantName: string;
  city: string;
  /** Optional invoicing details. Empty strings are allowed. */
  businessName: string;
  businessAddress: string;
}

/**
 * - `signed-in`      the account works and the host is already inside.
 * - `confirm-email`  the account exists but this project sends a confirmation
 *                    email first, so there is no session yet.
 * - `sign-in-required` the account and restaurant were created, but the browser
 *                    could not be signed in automatically.
 */
export type SignupOutcome = 'signed-in' | 'confirm-email' | 'sign-in-required';

/**
 * Mirrors the server-side rules so the form can answer instantly. The endpoint
 * re-checks everything, so this is only about fast feedback.
 */
export function validateSignup(input: HostSignupInput): string | null {
  const email = input.email.trim();
  if (!email) return 'Enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return 'Enter a valid email address.';

  if (!input.password) return 'Choose a password.';
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!/[^A-Za-z0-9]/.test(input.password)) {
    return 'Your password needs at least one special character, such as ! ? # or @.';
  }
  if (input.password !== input.confirmPassword) return 'The two passwords do not match.';

  if (!input.restaurantName.trim()) return 'Enter your restaurant name.';
  if (!input.city.trim()) return 'Enter your restaurant location.';
  return null;
}

function isUnconfirmedError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === 'email_not_confirmed') return true;
  return /not confirmed/i.test(error.message ?? '');
}

/**
 * Creates the host account and their restaurant in one server-side step, then
 * signs the new host in. The browser never sees a service key and never chooses
 * the owner id. The account was created on the server, so this sign-in is what
 * gives the browser a session; it uses the password the person just typed.
 */
export async function signUpHost(input: HostSignupInput): Promise<{ outcome: SignupOutcome }> {
  const email = input.email.trim().toLowerCase();

  const created = await callFunction<{ restaurantId: string; requiresEmailConfirmation?: boolean }>(
    'host-signup',
    {
      email,
      password: input.password,
      confirmPassword: input.confirmPassword,
      restaurantName: input.restaurantName.trim(),
      city: input.city.trim(),
      businessName: input.businessName.trim(),
      businessAddress: input.businessAddress.trim(),
    }
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password: input.password });
  if (!error) return { outcome: 'signed-in' };

  // The restaurant is already saved at this point, so nothing here is a failed
  // signup — the only question is whether a session could be started yet.
  if (created.requiresEmailConfirmation === true || isUnconfirmedError(error)) {
    return { outcome: 'confirm-email' };
  }
  return { outcome: 'sign-in-required' };
}
