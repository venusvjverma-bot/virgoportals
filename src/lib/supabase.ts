import { createClient } from '@supabase/supabase-js';

/**
 * Supabase's built-in auth lock waits on the browser's Web Locks API with no
 * timeout. On the password-reset callback that lock can be taken and never
 * released, so the first call that needs it — `updateUser()` while saving a new
 * password — stays pending forever and the screen spins on "Saving…". This is a
 * known supabase-js bug (supabase-js #2013, #1594; auth-js 2.71.1). A per-name
 * in-memory queue serialises the same operations without ever waiting on a
 * browser-held lock, so no call can block another indefinitely.
 */
const chains = new Map<string, Promise<void>>();

function inMemoryLock<R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  const previous = chains.get(name) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  chains.set(
    name,
    run.then(
      () => undefined,
      () => undefined
    )
  );
  return run;
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      // Persist the signed-in session in the browser's own storage so that a
      // reload, Back/Forward navigation, or closing and reopening the browser
      // restores it, and refresh the access token automatically while valid.
      // Stated explicitly rather than left to defaults so the intended
      // behaviour is guaranteed and cannot silently change.
      persistSession: true,
      autoRefreshToken: true,
      // Required so a password-reset link is recognised when it lands here.
      detectSessionInUrl: true,
      lock: inMemoryLock,
    },
  }
);
