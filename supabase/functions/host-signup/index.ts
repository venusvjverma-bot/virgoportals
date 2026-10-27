import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

/**
 * Public host signup.
 *
 * A visitor with no account yet asks to become a host. They cannot create their
 * own restaurant row directly: row level security only lets an ADMIN insert into
 * `restaurants`, and that is deliberate. So this endpoint does the privileged
 * part server-side with the service role key, which never leaves the server.
 *
 * Order of operations matters:
 *   1. Rate limit by IP (durable counters, so the limit holds across instances).
 *   2. Validate every field before touching anything.
 *   3. Refuse an email that already owns a restaurant.
 *   4. Create the Auth account.
 *   5. Create the restaurant row owned by that new account.
 *   6. If step 5 fails, undo step 4 so a retry starts clean instead of colliding
 *      with a half-finished account. No duplicate user, no duplicate restaurant.
 *
 * Ownership is linked to the Auth user id that GoTrue just minted. It is never
 * taken from the request body, so a caller cannot claim someone else's account.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SIGNUP_WINDOW_SECONDS = 600;
const SIGNUP_MAX_PER_WINDOW = 5;

const MIN_PASSWORD_LENGTH = 8;
/** GoTrue hashes with bcrypt, which silently ignores anything past 72 bytes. */
const MAX_PASSWORD_LENGTH = 72;
const MAX_NAME_LENGTH = 120;
const MAX_CITY_LENGTH = 120;

type Db = ReturnType<typeof createClient>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') ?? '';
  const first = forwarded.split(',')[0]?.trim();
  return first || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** At least one character that is neither a letter nor a digit. */
function hasSpecialCharacter(password: string): boolean {
  return /[^A-Za-z0-9]/.test(password);
}

/**
 * Reads GoTrue's public settings to learn whether this project actually sends
 * confirmation emails. When confirmation is off, the account must be created
 * already-confirmed or it could never sign in (no email would ever arrive). If
 * the settings call fails we assume confirmation is off, because an unusable
 * account is a worse outcome than a pre-confirmed one.
 */
async function emailConfirmationRequired(supabaseUrl: string, serviceKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!response.ok) return false;
    const settings = (await response.json()) as { mailer_autoconfirm?: boolean };
    return settings.mailer_autoconfirm === false;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const email = readString(body?.email).toLowerCase();
    const password = typeof body?.password === 'string' ? body.password : '';
    const confirmPassword = typeof body?.confirmPassword === 'string' ? body.confirmPassword : '';
    const restaurantName = readString(body?.restaurantName);
    const city = readString(body?.city);

    if (!email) return json({ error: 'Enter your email address.' }, 400);
    if (!isValidEmail(email)) return json({ error: 'Enter a valid email address.' }, 400);
    if (email.length > 254) return json({ error: 'That email address is too long.' }, 400);

    if (!password) return json({ error: 'Choose a password.' }, 400);
    if (password.length < MIN_PASSWORD_LENGTH) {
      return json({ error: `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.` }, 400);
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      return json({ error: `Choose a password of at most ${MAX_PASSWORD_LENGTH} characters.` }, 400);
    }
    if (!hasSpecialCharacter(password)) {
      return json(
        { error: 'Your password needs at least one special character, such as ! ? # or @.' },
        400
      );
    }
    if (password !== confirmPassword) {
      return json({ error: 'The two passwords do not match.' }, 400);
    }

    if (!restaurantName) return json({ error: 'Enter your restaurant name.' }, 400);
    if (restaurantName.length > MAX_NAME_LENGTH) {
      return json({ error: 'That restaurant name is too long.' }, 400);
    }
    if (!city) return json({ error: 'Enter your restaurant location.' }, 400);
    if (city.length > MAX_CITY_LENGTH) {
      return json({ error: 'That location is too long.' }, 400);
    }

    // The attempt limit is counted only once the fields themselves are sound, so
    // fixing a typo never costs somebody their remaining attempts. Only genuine
    // signup attempts are throttled.
    const allowed = await supabase.rpc('consume_rate_limit', {
      p_key: `signup:ip:${clientIp(req)}`,
      p_limit: SIGNUP_MAX_PER_WINDOW,
      p_window_seconds: SIGNUP_WINDOW_SECONDS,
    });
    if (allowed.error) throw allowed.error;
    if (allowed.data !== true) {
      return json(
        { error: 'Too many signup attempts from this connection. Please wait a few minutes and try again.' },
        429
      );
    }

    // One restaurant per email address, checked before the account is created so
    // an existing host is told plainly rather than ending up with two records.
    const { data: existing, error: existingError } = await supabase
      .from('restaurants')
      .select('id')
      .eq('owner_email', email)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      return json(
        { error: 'A host account already exists for that email. Sign in instead, or reset your password.' },
        409
      );
    }

    const needsConfirmation = await emailConfirmationRequired(supabaseUrl, serviceKey);

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: !needsConfirmation,
    });
    if (createError || !created?.user) {
      const message = createError?.message ?? '';
      if (/already|registered|exists/i.test(message)) {
        return json(
          { error: 'An account already exists for that email. Sign in instead, or reset your password.' },
          409
        );
      }
      return json({ error: message || 'Could not create your account.' }, 400);
    }

    const userId = created.user.id;

    const { data: botRow } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'botText')
      .maybeSingle();
    const defaultPrompt = ((botRow?.value as { text?: string } | undefined)?.text) ?? '';

    const { data: restaurant, error: insertError } = await supabase
      .from('restaurants')
      .insert({
        owner_email: email,
        owner_id: userId,
        name: restaurantName,
        city,
        system_prompt: defaultPrompt,
      })
      .select('id')
      .single();

    if (insertError || !restaurant) {
      // A lost response can look like a failure when the row was in fact written.
      // Confirm ownership first, and only undo the account when it truly has no
      // restaurant. That keeps a retry from creating a second account or a
      // second restaurant.
      const { data: owned } = await supabase
        .from('restaurants')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle();
      if (owned) {
        return json({ restaurantId: owned.id, requiresEmailConfirmation: needsConfirmation });
      }

      const { error: undoError } = await supabase.auth.admin.deleteUser(userId);
      if (undoError) {
        return json(
          {
            error:
              'Your restaurant could not be set up and the account could not be rolled back. Please contact the Virgo team.',
          },
          500
        );
      }
      return json(
        {
          error:
            insertError?.message ??
            'Your restaurant could not be set up. Nothing was saved, so you can try again.',
        },
        400
      );
    }

    return json({ restaurantId: restaurant.id, requiresEmailConfirmation: needsConfirmation });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'The signup service failed.' },
      500
    );
  }
});
