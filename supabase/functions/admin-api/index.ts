import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const CHAT_KEY = 'chatModel';
const IMAGE_KEY = 'imageModel';
const EXTRACT_KEY = 'extractModel';

const DEFAULT_TEMPERATURE = 0.8;
const DEFAULT_MAX_OUTPUT_TOKENS = 1500;
const MIN_TEMPERATURE = 0;
const MAX_TEMPERATURE = 2;
const MIN_MAX_OUTPUT_TOKENS = 1;
const MAX_MAX_OUTPUT_TOKENS = 100000;

interface ModelRow {
  key: string;
  provider: string | null;
  api_key: string | null;
  model: string | null;
  endpoint: string | null;
  reasoning_enabled?: boolean | null;
  temperature?: number | string | null;
  max_output_tokens?: number | null;
}

type Db = ReturnType<typeof createClient>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function authHeaders(provider: string | null, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if ((provider ?? '').toLowerCase().includes('azure')) {
    headers['api-key'] = apiKey;
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function describeFailure(kind: string, status: number, detail: string): string {
  let hint: string;
  if (status === 401 || status === 403) {
    hint = 'The provider rejected the API key. Check that the key is correct and still active.';
  } else if (status === 404) {
    hint = 'The endpoint was not found. Check the endpoint URL.';
  } else if (status === 429) {
    hint = 'The provider is rate limiting this key. Wait a moment and try again.';
  } else if (status >= 500) {
    hint = 'The provider had a server error. Try again shortly.';
  } else {
    hint = 'The provider rejected the request. Check the model name and the endpoint.';
  }
  const snippet = detail.replace(/\s+/g, ' ').trim().slice(0, 300);
  return `${hint} (${kind} test returned HTTP ${status})${snippet ? ` Provider said: ${snippet}` : ''}`;
}

function resolveKind(value: unknown): { kind: 'chat' | 'image' | 'extract'; key: string } {
  if (value === 'image') return { kind: 'image', key: IMAGE_KEY };
  if (value === 'extract') return { kind: 'extract', key: EXTRACT_KEY };
  return { kind: 'chat', key: CHAT_KEY };
}

function toPublic(row: ModelRow) {
  return {
    provider: row.provider ?? '',
    model: row.model ?? '',
    endpoint: row.endpoint ?? '',
    hasApiKey: Boolean(row.api_key && row.api_key.length > 0),
    reasoningEnabled: row.reasoning_enabled === true,
    temperature: Number(row.temperature ?? DEFAULT_TEMPERATURE),
    maxOutputTokens: Number(row.max_output_tokens ?? DEFAULT_MAX_OUTPUT_TOKENS),
  };
}

const MODEL_COLUMNS =
  'key, provider, api_key, model, endpoint, reasoning_enabled, temperature, max_output_tokens';

async function loadModel(supabase: Db, key: string): Promise<ModelRow | null> {
  const { data, error } = await supabase
    .from('model_settings')
    .select(MODEL_COLUMNS)
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return (data as ModelRow | null) ?? null;
}

/**
 * Only Venice documents a reasoning switch. Every other provider is left
 * untouched rather than sent a parameter it never agreed to accept.
 */
function isVenice(row: ModelRow): boolean {
  return `${row.provider ?? ''} ${row.endpoint ?? ''}`.toLowerCase().includes('venice');
}

interface GenerationSettings {
  reasoningEnabled: boolean;
  temperature: number;
  maxOutputTokens: number;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.replace(',', '.').trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function validateGeneration(
  body: Record<string, unknown> | null,
  existing: ModelRow | null
): { settings?: GenerationSettings; error?: string } {
  const hasTemperature = body?.temperature !== undefined && body?.temperature !== '';
  const hasMaxTokens = body?.maxOutputTokens !== undefined && body?.maxOutputTokens !== '';

  const existingTemperature = readNumber(existing?.temperature ?? null);
  const existingMaxTokens = readNumber(existing?.max_output_tokens ?? null);

  const temperature = hasTemperature ? readNumber(body?.temperature) : existingTemperature;
  if (temperature === null || temperature < MIN_TEMPERATURE || temperature > MAX_TEMPERATURE) {
    return {
      error: `Temperature must be a number between ${MIN_TEMPERATURE} and ${MAX_TEMPERATURE}.`,
    };
  }

  const maxOutputTokens = hasMaxTokens ? readNumber(body?.maxOutputTokens) : existingMaxTokens;
  if (
    maxOutputTokens === null ||
    !Number.isInteger(maxOutputTokens) ||
    maxOutputTokens < MIN_MAX_OUTPUT_TOKENS ||
    maxOutputTokens > MAX_MAX_OUTPUT_TOKENS
  ) {
    return {
      error: `Maximum output tokens must be a whole number between ${MIN_MAX_OUTPUT_TOKENS} and ${MAX_MAX_OUTPUT_TOKENS}.`,
    };
  }

  return {
    settings: {
      reasoningEnabled: body?.reasoningEnabled === true,
      temperature: Math.round(temperature * 100) / 100,
      maxOutputTokens,
    },
  };
}

/**
 * Returns a message to show the admin when a saved setting could not be sent
 * to the provider, so nothing is reported as applied when it was not.
 */
function applyReasoning(target: Record<string, unknown>, row: ModelRow): string | undefined {
  if (!isVenice(row)) {
    return row.reasoning_enabled === true
      ? 'Reasoning is switched on, but this provider is not Venice, so no reasoning parameter was sent. Pick a Venice endpoint to control reasoning.'
      : undefined;
  }

  target.reasoning = { enabled: row.reasoning_enabled === true };
  return row.reasoning_enabled === true
    ? 'Reasoning is switched on, so the model may think before answering and replies will be slower.'
    : undefined;
}

/**
 * Verifies the caller's Supabase Auth access token and returns the user id.
 * The identity comes from the verified token, never from the request body, so a
 * caller cannot claim to be somebody else. `getUser` validates the JWT against
 * the Auth server (signature, expiry, revocation) rather than trusting claims.
 */
async function verifyUser(supabase: Db, req: Request): Promise<string | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

/** True only when the user id is on the server-side admin allowlist. */
async function isAdminUser(supabase: Db, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('Content-Type') ?? '';
    let action: string | undefined;
    let body: Record<string, unknown> | null = null;
    let uploadFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      action = (formData.get('action') as string) ?? undefined;
      uploadFile = formData.get('file') as File | null;
    } else {
      body = await req.json().catch(() => null);
      action = body?.action as string | undefined;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const userId = await verifyUser(supabase, req);
    if (!userId) {
      return json({ error: 'Please sign in to continue.' }, 401);
    }
    if (!(await isAdminUser(supabase, userId))) {
      return json({ error: 'This account is not allowed to use the admin area.' }, 403);
    }

    if (action === 'whoami') {
      return json({ isAdmin: true });
    }

    if (action === 'read') {
      const [chat, image, extract] = await Promise.all([
        loadModel(supabase, CHAT_KEY),
        loadModel(supabase, IMAGE_KEY),
        loadModel(supabase, EXTRACT_KEY),
      ]);
      return json({
        chatModel: chat ? toPublic(chat) : { provider: '', model: '', endpoint: '', hasApiKey: false },
        imageModel: image ? toPublic(image) : { provider: '', model: '', endpoint: '', hasApiKey: false },
        extractModel: extract ? toPublic(extract) : { provider: '', model: '', endpoint: '', hasApiKey: false },
      });
    }

    if (action === 'save') {
      const { kind, key } = resolveKind(body?.kind);
      const provider = String(body?.provider ?? '').trim();
      const model = String(body?.model ?? '').trim();
      const endpoint = String(body?.endpoint ?? '').trim();
      const submittedKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';

      const existing = await loadModel(supabase, key);
      const apiKey = submittedKey.length > 0 ? submittedKey : existing?.api_key ?? '';

      const patch: Record<string, unknown> = {
        key,
        provider,
        model,
        endpoint,
        api_key: apiKey,
        updated_at: new Date().toISOString(),
      };

      // Generation settings belong to the chat model. The image model keeps
      // whatever it already has and is never touched by this page's settings.
      if (kind === 'chat') {
        const validated = validateGeneration(body as Record<string, unknown> | null, existing);
        if (validated.error) return json({ error: validated.error }, 400);
        const settings = validated.settings!;
        patch.reasoning_enabled = settings.reasoningEnabled;
        patch.temperature = settings.temperature;
        patch.max_output_tokens = settings.maxOutputTokens;
      }

      // The extraction model owns only its model name and reasoning switch.
      // Connection settings stay shared with the chat model and are never
      // written from this section.
      if (kind === 'extract') {
        const extractPatch: Record<string, unknown> = {
          key,
          model,
          reasoning_enabled: body?.reasoningEnabled === true,
          updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabase
          .from('model_settings')
          .upsert(extractPatch, { onConflict: 'key' })
          .select(MODEL_COLUMNS)
          .single();
        if (error) throw error;
        return json({ model: toPublic(data as ModelRow) });
      }

      const { data, error } = await supabase
        .from('model_settings')
        .upsert(patch, { onConflict: 'key' })
        .select(MODEL_COLUMNS)
        .single();
      if (error) throw error;

      return json({ model: toPublic(data as ModelRow) });
    }

    if (action === 'test') {
      const { kind, key } = resolveKind(body?.kind);

      // Extraction tests the extraction model + reasoning over the shared
      // connection (provider, key, endpoint) from the chat model.
      if (kind === 'extract') {
        const [extractConfig, chatConfig] = await Promise.all([
          loadModel(supabase, EXTRACT_KEY),
          loadModel(supabase, CHAT_KEY),
        ]);
        if (!extractConfig?.model || !chatConfig?.api_key || !chatConfig.endpoint) {
          return json({ error: 'Admin has not set the extraction model or the shared connection.' }, 400);
        }
        const testBody: Record<string, unknown> = {
          model: extractConfig.model,
          temperature: 0,
          max_tokens: 1000,
          messages: [
            { role: 'system', content: 'You are a connection test for a restaurant menu assistant.' },
            { role: 'user', content: 'Reply in one short sentence confirming you are online.' },
          ],
        };
        const notice = applyReasoning(testBody, extractConfig);

        const response = await fetch(chatConfig.endpoint, {
          method: 'POST',
          headers: authHeaders(chatConfig.provider, chatConfig.api_key),
          body: JSON.stringify(testBody),
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          return json({ error: describeFailure('extraction', response.status, detail) }, 502);
        }
        let payload: { choices?: Array<{ message?: { content?: unknown } }> } | null = null;
        try {
          payload = await response.json();
        } catch {
          return json({ error: 'The extraction model returned a response that was not valid JSON.' }, 502);
        }
        const rawText = payload?.choices?.[0]?.message?.content;
        const reply = typeof rawText === 'string' ? rawText.trim() : '';
        if (!reply) {
          return json(
            {
              error:
                'The extraction model responded but no message text was found. Check that the endpoint returns an OpenAI-compatible chat completion.',
            },
            502
          );
        }
        return json({ reply, notice });
      }

      const config = await loadModel(supabase, key);

      if (!config?.api_key || !config.endpoint || !config.model) {
        return json(
          {
            error:
              kind === 'chat'
                ? 'Admin has not set the chat model'
                : 'Admin has not set the image model',
          },
          400
        );
      }

      if (kind === 'chat') {
        const chatBody: Record<string, unknown> = {
          model: config.model,
          temperature: Number(config.temperature ?? DEFAULT_TEMPERATURE),
          max_tokens: Number(config.max_output_tokens ?? DEFAULT_MAX_OUTPUT_TOKENS),
          messages: [
            {
              role: 'system',
              content: 'You are a connection test for a restaurant menu assistant.',
            },
            {
              role: 'user',
              content: 'Reply in one short sentence confirming you are online.',
            },
          ],
        };
        const notice = applyReasoning(chatBody, config);

        const response = await fetch(config.endpoint, {
          method: 'POST',
          headers: authHeaders(config.provider, config.api_key),
          body: JSON.stringify(chatBody),
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          return json({ error: describeFailure('chat', response.status, detail) }, 502);
        }

        let payload: { choices?: Array<{ message?: { content?: unknown } }> } | null = null;
        try {
          payload = await response.json();
        } catch {
          return json({ error: 'The chat model returned a response that was not valid JSON.' }, 502);
        }

        const raw = payload?.choices?.[0]?.message?.content;
        const reply = typeof raw === 'string' ? raw.trim() : '';
        if (!reply) {
          return json(
            {
              error:
                'The chat model responded but no message text was found. Check that the endpoint returns an OpenAI-compatible chat completion.',
            },
            502
          );
        }

        return json({ reply, notice });
      }

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: authHeaders(config.provider, config.api_key),
        body: JSON.stringify({
          model: config.model,
          prompt:
            'A simple photograph of a freshly plated dish on a rustic wooden table, soft natural light',
          n: 1,
          size: '1024x1024',
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        return json({ error: describeFailure('image', response.status, detail) }, 502);
      }

      let payload: Record<string, unknown> | null = null;
      try {
        payload = await response.json() as Record<string, unknown>;
      } catch {
        return json({ error: 'The image model returned a response that was not valid JSON.' }, 502);
      }

      const data = payload?.data;
      const dataArray = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : null;
      const dataObj = data && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : null;

      // Atlas Cloud and similar async providers return { data: { id, status } }
      // and require polling /prediction/{id} for the final image URL.
      if (dataObj && typeof dataObj.id === 'string') {
        const requestId = dataObj.id;
        const status0 = typeof dataObj.status === 'string' ? dataObj.status : '';

        if (status0 === 'failed' || status0 === 'error') {
          const errMsg = typeof dataObj.error === 'string' ? dataObj.error : 'Generation failed.';
          return json({ error: `The image model rejected the request: ${errMsg}` }, 502);
        }

        if (status0 === 'completed' || status0 === 'succeeded') {
          const outputs = Array.isArray(dataObj.outputs)
            ? (dataObj.outputs as unknown[])
            : null;
          const imageUrl = outputs && typeof outputs[0] === 'string' ? outputs[0] : '';
          if (!imageUrl) {
            return json({ error: 'The image model completed but returned no image URL.' }, 502);
          }
          const download = await fetch(imageUrl);
          if (!download.ok) {
            return json(
              { error: `The image URL could not be downloaded (HTTP ${download.status}).` },
              502
            );
          }
          const base64 = bytesToBase64(new Uint8Array(await download.arrayBuffer()));
          return json({ imageUrl: `data:image/png;base64,${base64}` });
        }

        // status is "processing" or similar — poll the prediction endpoint.
        const pollUrl = config.endpoint.replace(
          /\/model\/generateImage$/,
          `/model/prediction/${requestId}`
        );
        if (pollUrl === config.endpoint) {
          return json(
            { error: 'The image model returned a prediction ID but the endpoint does not follow the /model/generateImage pattern, so the result cannot be polled.' },
            502
          );
        }

        const MAX_POLLS = 30;
        const POLL_INTERVAL_MS = 2000;
        for (let i = 0; i < MAX_POLLS; i++) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

          const pollResponse = await fetch(pollUrl, {
            method: 'GET',
            headers: authHeaders(config.provider, config.api_key),
          });
          if (!pollResponse.ok) {
            const detail = await pollResponse.text().catch(() => '');
            return json(
              { error: describeFailure('image', pollResponse.status, detail) },
              502
            );
          }

          let pollPayload: { data?: Record<string, unknown> } | null = null;
          try {
            pollPayload = await pollResponse.json() as { data?: Record<string, unknown> };
          } catch {
            return json({ error: 'The image model polling endpoint returned invalid JSON.' }, 502);
          }

          const pollData = pollPayload?.data;
          if (!pollData || typeof pollData !== 'object') {
            return json({ error: 'The image model polling response had no data object.' }, 502);
          }

          const status = typeof pollData.status === 'string' ? pollData.status : '';

          if (status === 'failed' || status === 'error') {
            const errMsg = typeof pollData.error === 'string' ? pollData.error : 'Generation failed.';
            return json({ error: `The image model failed to generate: ${errMsg}` }, 502);
          }

          if (status === 'completed' || status === 'succeeded') {
            const outputs = Array.isArray(pollData.outputs)
              ? (pollData.outputs as unknown[])
              : null;
            const imageUrl = outputs && typeof outputs[0] === 'string' ? outputs[0] : '';
            if (!imageUrl) {
              return json({ error: 'The image model completed but returned no image URL.' }, 502);
            }
            const download = await fetch(imageUrl);
            if (!download.ok) {
              return json(
                { error: `The image URL could not be downloaded (HTTP ${download.status}).` },
                502
              );
            }
            const base64 = bytesToBase64(new Uint8Array(await download.arrayBuffer()));
            return json({ imageUrl: `data:image/png;base64,${base64}` });
          }
          // status is still "processing" — keep polling.
        }

        return json(
          { error: 'The image model did not finish within the polling timeout. Try again.' },
          504
        );
      }

      // Synchronous providers (OpenAI Images API style) return
      // { data: [{ b64_json?: string, url?: string }] }.
      const first = dataArray?.[0];
      let base64 = first && typeof first.b64_json === 'string' ? first.b64_json : '';

      if (!base64 && first && typeof first.url === 'string') {
        const download = await fetch(first.url);
        if (!download.ok) {
          return json(
            {
              error: `The image model returned an image link, but it could not be downloaded (HTTP ${download.status}).`,
            },
            502
          );
        }
        base64 = bytesToBase64(new Uint8Array(await download.arrayBuffer()));
      }

      if (!base64) {
        return json(
          {
            error:
              'The image model responded but no image data was found. Check that the endpoint returns image data.',
          },
          502
        );
      }

      return json({ imageUrl: `data:image/png;base64,${base64}` });
    }

    // Cross-host reads that RLS deliberately prevents for hosts: only an admin
    // reaches this point, and only the fields the dashboard renders are returned.
    if (action === 'hosts') {
      const [restaurantsResult, dishesResult] = await Promise.all([
        supabase
          .from('restaurants')
          .select('id, owner_email, name, city, welcome, system_prompt, status, created_at')
          .order('created_at', { ascending: true }),
        supabase.from('dishes').select('restaurant_id'),
      ]);
      if (restaurantsResult.error) throw restaurantsResult.error;
      if (dishesResult.error) throw dishesResult.error;

      const counts = new Map<string, number>();
      for (const row of (dishesResult.data ?? []) as Array<{ restaurant_id: string }>) {
        counts.set(row.restaurant_id, (counts.get(row.restaurant_id) ?? 0) + 1);
      }

      const hosts = ((restaurantsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: row.id,
        restaurant: (row.name as string) || (row.owner_email as string),
        email: row.owner_email,
        city: (row.city as string) || '—',
        signupDate: row.created_at,
        dishes: counts.get(row.id as string) ?? 0,
        status: row.status === 'Blocked' ? 'Blocked' : 'Active',
        welcomeText: row.welcome,
        botPrompt: row.system_prompt,
        ownerId: row.id,
        hasOwner: false,
      }));
      return json({ hosts });
    }

    if (action === 'usage') {
      const [restaurantsResult, usageResult] = await Promise.all([
        supabase.from('restaurants').select('id, name, owner_email').order('created_at', { ascending: true }),
        // usage_events exceeds the default 1000-row page, so aggregate every
        // page until the table is exhausted or the totals stop growing.
        (async () => {
          const PAGE = 1000;
          const counts = new Map<string, { uploads: number; images: number; messages: number }>();
          for (let from = 0; ; from += PAGE) {
            const { data, error } = await supabase
              .from('usage_events')
              .select('restaurant_id, kind')
              .range(from, from + PAGE - 1);
            if (error) throw error;
            const page = (data ?? []) as Array<{ restaurant_id: string | null; kind: string }>;
            for (const row of page) {
              if (!row.restaurant_id) continue;
              const entry = counts.get(row.restaurant_id) ?? { uploads: 0, images: 0, messages: 0 };
              if (row.kind === 'upload') entry.uploads += 1;
              if (row.kind === 'image') entry.images += 1;
              if (row.kind === 'message') entry.messages += 1;
              counts.set(row.restaurant_id, entry);
            }
            if (page.length < PAGE) return counts;
          }
        })(),
      ]);
      if (restaurantsResult.error) throw restaurantsResult.error;

      const totals = usageResult;

      const rows = ((restaurantsResult.data ?? []) as Array<{ id: string; name: string; owner_email: string }>).map(
        (row) => {
          const entry = totals.get(row.id) ?? { uploads: 0, images: 0, messages: 0 };
          return {
            id: row.id,
            host: row.name || row.owner_email,
            uploads: entry.uploads,
            images: entry.images,
            messages: entry.messages,
          };
        }
      );
      return json({ usage: rows });
    }

    if (action === 'getBotText') {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'botText')
        .maybeSingle();
      if (error) throw error;
      const value = data?.value as { text?: string } | undefined;
      return json({ text: value?.text ?? '' });
    }

    if (action === 'saveBotText') {
      const text = typeof body?.text === 'string' ? body.text : '';
      const { error } = await supabase
        .from('app_config')
        .upsert({ key: 'botText', value: { text }, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ text });
    }

    if (action === 'setHostStatus') {
      const restaurantId = String(body?.restaurantId ?? '');
      const status = body?.status === 'Blocked' ? 'Blocked' : 'Active';
      if (!restaurantId) return json({ error: 'Missing host.' }, 400);
      const { error } = await supabase
        .from('restaurants')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', restaurantId);
      if (error) throw error;
      return json({ status });
    }

    // Admin-provisioned host: creates the Auth account, links a restaurant and
    // records the ownership in one server-side step. There is no public signup.
    if (action === 'createHost') {
      const email = String(body?.email ?? '').trim().toLowerCase();
      const password = String(body?.password ?? '');
      const restaurantName = String(body?.restaurantName ?? '').trim();
      const city = String(body?.city ?? '').trim();

      if (!email || !email.includes('@')) {
        return json({ error: 'Enter a valid host email address.' }, 400);
      }
      if (password.length < 8) {
        return json({ error: 'Choose a password of at least 8 characters.' }, 400);
      }

      const { data: existing } = await supabase
        .from('restaurants')
        .select('id')
        .eq('owner_email', email)
        .maybeSingle();
      if (existing) {
        return json({ error: 'A host with that email already exists.' }, 409);
      }

      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError || !created?.user) {
        return json({ error: createError?.message ?? 'Could not create the host account.' }, 400);
      }

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
          owner_id: created.user.id,
          name: restaurantName,
          city,
          system_prompt: defaultPrompt,
        })
        .select('id')
        .single();

      if (insertError) {
        await supabase.auth.admin.deleteUser(created.user.id);
        return json({ error: insertError.message }, 400);
      }

      return json({ restaurantId: restaurant.id, userId: created.user.id });
    }

    // Theme asset library — admin-only image upload, list, and delete.
    const ALLOWED_THEME_TYPES = new Set([
      'image/jpeg', 'image/png', 'image/apng',
    ]);

    if (action === 'listThemeAssets') {
      const { data, error: listError } = await supabase
        .from('theme_assets')
        .select('id, filename, storage_path, content_type, size_bytes, shared, created_at')
        .order('created_at', { ascending: false });
      if (listError) throw listError;
      const assets = (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id,
        filename: row.filename,
        storagePath: row.storage_path,
        contentType: row.content_type,
        sizeBytes: row.size_bytes,
        shared: row.shared === true,
        createdAt: row.created_at,
      }));
      return json({ assets });
    }

    if (action === 'setThemeAssetShared') {
      const assetId = String(body?.assetId ?? '');
      if (!assetId) return json({ error: 'Missing asset ID.' }, 400);
      if (typeof body?.shared !== 'boolean') {
        return json({ error: 'Missing shared flag.' }, 400);
      }
      const shared = body.shared;

      // When revoking, clear every assignment that points at this image so
      // visitor chat pages fall back to the plain background immediately.
      if (!shared) {
        const { error: deptError } = await supabase
          .from('departments')
          .update({ chat_background_asset_id: null })
          .eq('chat_background_asset_id', assetId);
        if (deptError) throw deptError;
        const { error: eventError } = await supabase
          .from('events')
          .update({ chat_background_asset_id: null })
          .eq('chat_background_asset_id', assetId);
        if (eventError) throw eventError;
      }

      const { data, error } = await supabase
        .from('theme_assets')
        .update({ shared })
        .eq('id', assetId)
        .select('id, filename, storage_path, content_type, size_bytes, shared, created_at')
        .single();
      if (error) throw error;
      const row = data as Record<string, unknown>;
      return json({
        asset: {
          id: row.id,
          filename: row.filename,
          storagePath: row.storage_path,
          contentType: row.content_type,
          sizeBytes: row.size_bytes,
          shared: row.shared === true,
          createdAt: row.created_at,
        },
      });
    }

    if (action === 'uploadThemeAsset') {
      if (!uploadFile) return json({ error: 'No file provided.' }, 400);
      const fileContentType = uploadFile.type || 'application/octet-stream';
      if (!ALLOWED_THEME_TYPES.has(fileContentType)) {
        return json({ error: 'Unsupported file type. Use .jpg, .jpeg, .png, or .apng.' }, 400);
      }

      const assetId = crypto.randomUUID();
      const ext = fileContentType === 'image/jpeg' ? 'jpg' : 'png';
      const storagePath = `${assetId}.${ext}`;
      const fileBytes = new Uint8Array(await uploadFile.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('theme-assets')
        .upload(storagePath, fileBytes, { contentType: fileContentType, upsert: false });
      if (uploadError) throw uploadError;

      const { data: assetRow, error: insertError } = await supabase
        .from('theme_assets')
        .insert({
          id: assetId,
          filename: uploadFile.name,
          storage_path: storagePath,
          content_type: fileContentType,
          size_bytes: uploadFile.size,
          shared: true,
        })
        .select('id, filename, storage_path, content_type, size_bytes, shared, created_at')
        .single();
      if (insertError) {
        await supabase.storage.from('theme-assets').remove([storagePath]);
        throw insertError;
      }

      const row = assetRow as Record<string, unknown>;
      return json({
        asset: {
          id: row.id,
          filename: row.filename,
          storagePath: row.storage_path,
          contentType: row.content_type,
          sizeBytes: row.size_bytes,
          shared: row.shared === true,
          createdAt: row.created_at,
        },
      });
    }

    if (action === 'deleteThemeAsset') {
      const assetId = String(body?.assetId ?? '');
      if (!assetId) return json({ error: 'Missing asset ID.' }, 400);

      const { data: asset, error: fetchError } = await supabase
        .from('theme_assets')
        .select('storage_path')
        .eq('id', assetId)
        .maybeSingle();
      if (fetchError) throw fetchError;
      if (!asset) return json({ error: 'Asset not found.' }, 404);

      const storagePath = (asset as Record<string, unknown>).storage_path as string;
      const { error: storageError } = await supabase.storage
        .from('theme-assets')
        .remove([storagePath]);
      if (storageError) throw storageError;

      const { error: deleteError } = await supabase
        .from('theme_assets')
        .delete()
        .eq('id', assetId);
      if (deleteError) throw deleteError;

      return json({ success: true });
    }

    // ── Credit Controller: list all hosts with balance and LLM status ──
    if (action === 'listCredits') {
      const { data: restaurants, error: restError } = await supabase
        .from('restaurants')
        .select('id, owner_email, name, city, status')
        .order('created_at', { ascending: true });
      if (restError) throw restError;

      const { data: credits, error: creditError } = await supabase
        .from('host_credits')
        .select('restaurant_id, balance');
      if (creditError) throw creditError;

      const balanceMap = new Map<string, number>();
      for (const row of (credits ?? []) as Array<{ restaurant_id: string; balance: string }>) {
        balanceMap.set(row.restaurant_id, Number(row.balance));
      }

      const result = ((restaurants ?? []) as Array<{ id: string; owner_email: string; name: string; city: string; status: string }>).map((row) => {
        const balance = balanceMap.get(row.id) ?? 0;
        return {
          restaurantId: row.id,
          email: row.owner_email,
          name: row.name,
          city: row.city || '—',
          status: row.status === 'Blocked' ? 'Blocked' : 'Active',
          balance,
          llmActive: balance > 0,
        };
      });
      return json({ hosts: result });
    }

    // ── Credit Controller: add or remove credits ──
    if (action === 'adjustCredit') {
      const restaurantId = String(body?.restaurantId ?? '');
      const operation = body?.operation === 'remove' ? 'remove' : 'add';
      const rawAmount = Number(body?.amount);

      if (!restaurantId) return json({ error: 'Missing host.' }, 400);
      if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
        return json({ error: 'Enter a positive amount.' }, 400);
      }

      // Round to 6 decimal places to match the numeric(12,6) column
      const amount = Math.round(rawAmount * 1_000_000) / 1_000_000;

      const { data: result, error: adjustError } = await supabase
        .rpc('adjust_host_credit', {
          p_restaurant_id: restaurantId,
          p_admin_user_id: userId,
          p_operation: operation,
          p_amount: amount,
        });
      if (adjustError) {
        return json({ error: adjustError.message }, 400);
      }

      const row = (result as Array<{ previous_balance: string; resulting_balance: string }> | null)?.[0];
      if (!row) return json({ error: 'Adjustment failed.' }, 500);

      return json({
        previousBalance: Number(row.previous_balance),
        resultingBalance: Number(row.resulting_balance),
      });
    }

    // ── Credit Controller: audit trail for a specific host ──
    if (action === 'listCreditAdjustments') {
      const restaurantId = String(body?.restaurantId ?? '');
      if (!restaurantId) return json({ error: 'Missing host.' }, 400);

      const { data: adjustments, error: adjError } = await supabase
        .from('host_credit_adjustments')
        .select('id, operation, amount, previous_balance, resulting_balance, created_at')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (adjError) throw adjError;

      const rows = (adjustments ?? []).map((row: Record<string, unknown>) => ({
        id: row.id,
        operation: row.operation,
        amount: Number(row.amount),
        previousBalance: Number(row.previous_balance),
        resultingBalance: Number(row.resulting_balance),
        createdAt: row.created_at,
      }));
      return json({ adjustments: rows });
    }

    return json({ error: 'Unknown admin action.' }, 400);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'The admin service failed.' },
      500
    );
  }
});
