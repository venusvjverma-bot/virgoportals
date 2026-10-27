import { supabase } from '@/lib/supabase';

interface ErrorBody {
  error?: string;
}

/**
 * Calls an edge function with the signed-in user's access token, so the server
 * can verify the identity itself. The anon key is only a fallback for the
 * public chat, which has no session.
 */
export async function callFunction<T>(name: string, payload: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => null)) as (T & ErrorBody) | null;

  if (!response.ok) {
    throw new Error(body?.error ?? `The server could not complete that request (${response.status}).`);
  }
  if (!body) {
    throw new Error('The server returned an empty response.');
  }
  return body as T;
}
