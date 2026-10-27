import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ModelConfig {
  provider?: string;
  apiKey?: string;
  model?: string;
  endpoint?: string;
}

type Db = ReturnType<typeof createClient>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function providerHeaders(provider: string, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider.toLowerCase().includes('azure')) {
    headers['api-key'] = apiKey;
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}

function buildPrompt(name: string, description: string, ingredients: string): string {
  const parts = [`A professional food photograph of ${name}.`];
  if (description) parts.push(description.replace(/\s+/g, ' ').trim() + '.');
  if (ingredients) parts.push(`Made with ${ingredients.replace(/\s+/g, ' ').trim()}.`);
  parts.push('Plated on a rustic table, soft natural light, overhead angle, appetizing, high detail.');
  return parts.join(' ');
}

/**
 * Verifies the caller's Supabase Auth access token and returns the user id.
 * The identity comes from the verified token, never from the request body, so a
 * caller cannot claim to own a restaurant they do not own.
 */
async function verifyUser(supabase: Db, req: Request): Promise<string | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    const restaurantId = body?.restaurantId as string | undefined;
    const dishId = body?.dishId as string | undefined;

    if (!restaurantId || !dishId) return json({ error: 'Missing dish.' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const userId = await verifyUser(supabase, req);
    if (!userId) return json({ error: 'Please sign in to continue.' }, 401);

    // Ownership is verified against the database, not the request. A host may
    // only generate images for a restaurant their account owns.
    const { data: owned, error: ownerError } = await supabase
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .eq('owner_id', userId)
      .maybeSingle();
    if (ownerError) throw ownerError;
    if (!owned) return json({ error: 'This restaurant is not on your account.' }, 403);

    const { data: dish, error: dishError } = await supabase
      .from('dishes')
      .select('id, name, description, ingredients, restaurant_id')
      .eq('id', dishId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    if (dishError) throw dishError;
    if (!dish) return json({ error: 'That dish no longer exists.' }, 404);

    const { data: configRow, error: configError } = await supabase
      .from('model_settings')
      .select('provider, api_key, model, endpoint')
      .eq('key', 'imageModel')
      .maybeSingle();
    if (configError) throw configError;

    const image: ModelConfig = {
      provider: configRow?.provider ?? '',
      apiKey: configRow?.api_key ?? '',
      model: configRow?.model ?? '',
      endpoint: configRow?.endpoint ?? '',
    };
    if (!image.apiKey || !image.endpoint || !image.model) {
      return json({ error: 'Admin has not set the image model' }, 400);
    }

    const prompt = buildPrompt(
      dish.name ?? 'a dish',
      dish.description ?? '',
      dish.ingredients ?? ''
    );

    const imageResponse = await fetch(image.endpoint, {
      method: 'POST',
      headers: providerHeaders(image.provider ?? '', image.apiKey),
      body: JSON.stringify({
        model: image.model,
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'medium',
        background: 'auto',
        output_format: 'png',
      }),
    });

    if (!imageResponse.ok) {
      const detail = await imageResponse.text().catch(() => '');
      return json(
        {
          error: `The image model rejected the request (${imageResponse.status}).`,
          detail: detail.slice(0, 300),
        },
        502
      );
    }

    let payload: Record<string, unknown> | null = null;
    try {
      payload = await imageResponse.json() as Record<string, unknown>;
    } catch {
      return json({ error: 'The image model returned an unreadable response.' }, 502);
    }

    const data = payload?.data;
    const dataArray = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : null;
    const dataObj = data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;

    let bytes: Uint8Array | null = null;

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
        const outputs = Array.isArray(dataObj.outputs) ? (dataObj.outputs as unknown[]) : null;
        const imageUrl = outputs && typeof outputs[0] === 'string' ? outputs[0] : '';
        if (imageUrl) {
          const download = await fetch(imageUrl);
          if (download.ok) bytes = new Uint8Array(await download.arrayBuffer());
        }
      } else {
        // status is "processing" — poll the prediction endpoint.
        const pollUrl = image.endpoint.replace(
          /\/model\/generateImage$/,
          `/model/prediction/${requestId}`
        );
        if (pollUrl !== image.endpoint) {
          const MAX_POLLS = 30;
          const POLL_INTERVAL_MS = 2000;
          for (let i = 0; i < MAX_POLLS && !bytes; i++) {
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

            const pollResponse = await fetch(pollUrl, {
              method: 'GET',
              headers: providerHeaders(image.provider ?? '', image.apiKey),
            });
            if (!pollResponse.ok) break;

            let pollPayload: { data?: Record<string, unknown> } | null = null;
            try {
              pollPayload = await pollResponse.json() as { data?: Record<string, unknown> };
            } catch {
              break;
            }

            const pollData = pollPayload?.data;
            if (!pollData || typeof pollData !== 'object') break;

            const status = typeof pollData.status === 'string' ? pollData.status : '';

            if (status === 'failed' || status === 'error') {
              const errMsg = typeof pollData.error === 'string' ? pollData.error : 'Generation failed.';
              return json({ error: `The image model failed to generate: ${errMsg}` }, 502);
            }

            if (status === 'completed' || status === 'succeeded') {
              const outputs = Array.isArray(pollData.outputs) ? (pollData.outputs as unknown[]) : null;
              const imageUrl = outputs && typeof outputs[0] === 'string' ? outputs[0] : '';
              if (imageUrl) {
                const download = await fetch(imageUrl);
                if (download.ok) bytes = new Uint8Array(await download.arrayBuffer());
              }
            }
          }
        }
      }

      if (!bytes || bytes.length === 0) {
        return json(
          { error: 'The image model did not produce an image within the polling timeout.' },
          504
        );
      }
    } else {
      // Synchronous providers (OpenAI Images API style) return
      // { data: [{ b64_json?: string, url?: string }] }.
      const first = dataArray?.[0];
      if (first?.b64_json) {
        bytes = base64ToBytes(first.b64_json);
      } else if (first?.url) {
        const download = await fetch(first.url);
        if (download.ok) bytes = new Uint8Array(await download.arrayBuffer());
      }
    }

    if (!bytes || bytes.length === 0) {
      return json({ error: 'The image model did not return an image.' }, 502);
    }

    const path = `${restaurantId}/${dishId}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from('dish-images')
      .upload(path, bytes, { contentType: 'image/png', upsert: true });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from('dish-images').getPublicUrl(path);
    const imageUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
      .from('dishes')
      .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
      .eq('id', dishId)
      .eq('restaurant_id', restaurantId);
    if (updateError) throw updateError;

    await supabase.from('usage_events').insert({ restaurant_id: restaurantId, kind: 'image' });

    return json({ imageUrl });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Image generation failed.' },
      500
    );
  }
});
