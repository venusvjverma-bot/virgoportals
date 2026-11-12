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

interface BeginResult {
  generation_id: string | null;
  was_duplicate: boolean;
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

  let supabaseRef: Db | null = null;
  let generationRecordId: string | null = null;
  try {
    const body = await req.json().catch(() => null);
    const restaurantId = body?.restaurantId as string | undefined;
    const dishId = body?.dishId as string | undefined;
    const comboId = body?.comboId as string | undefined;
    const clientRequestId =
      typeof body?.clientRequestId === 'string' && body.clientRequestId.length > 0
        ? body.clientRequestId
        : crypto.randomUUID();

    if (!restaurantId || (!dishId && !comboId) || (dishId && comboId)) {
      return json({ error: 'Missing dish or combo.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);
    supabaseRef = supabase;

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

    const isCombo = Boolean(comboId);
    const targetId = (comboId ?? dishId) as string;
    const { data: target, error: targetError } = isCombo
      ? await supabase
          .from('combos')
          .select('id, name, description')
          .eq('id', comboId)
          .eq('restaurant_id', restaurantId)
          .maybeSingle()
      : await supabase
          .from('dishes')
          .select('id, name, description, ingredients, restaurant_id')
          .eq('id', dishId)
          .eq('restaurant_id', restaurantId)
          .maybeSingle();
    if (targetError) throw targetError;
    if (!target) {
      return json({ error: isCombo ? 'That combo no longer exists.' : 'That dish no longer exists.' }, 404);
    }
    const targetRow = target as { name?: string; description?: string; ingredients?: string };

    // Credit pre-flight: fails stale pending attempts (crash recovery),
    // enforces the 1-credit minimum and deducts exactly 1 credit atomically.
    // An idempotency key derived from the client's request ID makes retries of
    // the same click free; every new Generate click gets a fresh key.
    const idempotencyKey = `${restaurantId}:${isCombo ? 'combo' : 'dish'}:${targetId}:${clientRequestId}`;
    const { data: beginData, error: beginError } = await supabase.rpc(
      'begin_dish_image_generation',
      {
        p_restaurant_id: restaurantId,
        p_target_type: isCombo ? 'combo' : 'dish',
        p_target_id: targetId,
        p_target_name: targetRow.name ?? (isCombo ? 'a combo meal' : 'a dish'),
        p_idempotency_key: idempotencyKey,
      }
    );
    if (beginError) {
      const message = beginError.message ?? '';
      if (message.includes('INSUFFICIENT_CREDITS')) {
        return json(
          { error: 'You need at least 1 credit to generate a dish image. Add credits in your Credit Wallet or contact the Virgo team.' },
          402
        );
      }
      throw beginError;
    }
    const beginRows = Array.isArray(beginData) ? (beginData as BeginResult[]) : [];
    const begin = beginRows[0] ?? null;
    generationRecordId = begin?.generation_id ?? null;
    if (!generationRecordId) {
      throw new Error('Could not record the generation request.');
    }

    // Wraps every failure path so the deducted credit is refunded exactly once
    // before the error is returned to the host.
    const failGeneration = async (message: string, status: number, apiGenerationId?: string) => {
      await supabase.rpc('complete_dish_image_generation', {
        p_generation_id: generationRecordId,
        p_success: false,
        p_api_generation_id: apiGenerationId ?? null,
        p_error_message: message,
      });
      return json({ error: message }, status);
    };

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
      return failGeneration('Admin has not set the image model', 400);
    }

    const prompt = buildPrompt(
      targetRow.name ?? (isCombo ? 'a combo meal' : 'a dish'),
      targetRow.description ?? '',
      targetRow.ingredients ?? ''
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
      return failGeneration(
        `The image model rejected the request (${imageResponse.status}).`,
        502
      );
    }

    let payload: Record<string, unknown> | null = null;
    try {
      payload = await imageResponse.json() as Record<string, unknown>;
    } catch {
      return failGeneration('The image model returned an unreadable response.', 502);
    }

    const data = payload?.data;
    const dataArray = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : null;
    const dataObj = data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;

    // Generation/prediction identifier: captured the moment the initial
    // response arrives, before polling. Async providers return data.id;
    // sync providers may carry a top-level id. Stored as null when absent.
    let apiGenerationId: string | null = null;
    if (dataObj && typeof dataObj.id === 'string') {
      apiGenerationId = dataObj.id;
    } else if (typeof payload?.id === 'string') {
      apiGenerationId = payload.id;
    }

    let bytes: Uint8Array | null = null;

    // Atlas Cloud and similar async providers return { data: { id, status } }
    // and require polling /prediction/{id} for the final image URL.
    if (dataObj && typeof dataObj.id === 'string') {
      const requestId = dataObj.id;
      const status0 = typeof dataObj.status === 'string' ? dataObj.status : '';

      if (status0 === 'failed' || status0 === 'error') {
        const errMsg = typeof dataObj.error === 'string' ? dataObj.error : 'Generation failed.';
        return failGeneration(`The image model rejected the request: ${errMsg}`, 502, apiGenerationId);
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
              return failGeneration(`The image model failed to generate: ${errMsg}`, 502, apiGenerationId);
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
        return failGeneration(
          'The image model did not produce an image within the polling timeout.',
          504,
          apiGenerationId
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
      return failGeneration('The image model did not return an image.', 502, apiGenerationId);
    }

    const path = `${restaurantId}/${isCombo ? 'combo-' : ''}${targetId}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from('dish-images')
      .upload(path, bytes, { contentType: 'image/png', upsert: true });
    if (uploadError) {
      return failGeneration(
        'The generated image could not be saved. Your credit has been refunded.',
        500,
        apiGenerationId
      );
    }

    const { data: publicUrlData } = supabase.storage.from('dish-images').getPublicUrl(path);
    const imageUrl = publicUrlData.publicUrl;

    const { error: updateError } = isCombo
      ? await supabase
          .from('combos')
          .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
          .eq('id', targetId)
          .eq('restaurant_id', restaurantId)
      : await supabase
          .from('dishes')
          .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
          .eq('id', targetId)
          .eq('restaurant_id', restaurantId);
    if (updateError) {
      return failGeneration(
        'The image was generated but could not be attached to the dish. Your credit has been refunded.',
        500,
        apiGenerationId
      );
    }

    await supabase.from('usage_events').insert({ restaurant_id: restaurantId, kind: 'image' });

    await supabase.rpc('complete_dish_image_generation', {
      p_generation_id: generationRecordId,
      p_success: true,
      p_api_generation_id: apiGenerationId,
      p_error_message: null,
    });

    return json({ imageUrl });
  } catch (error) {
    // An unexpected throw after the credit was deducted (e.g. a network
    // failure calling the API) refunds the credit here; the completion
    // function is idempotent, so an already-refunded record is untouched.
    if (generationRecordId && supabaseRef) {
      await supabaseRef.rpc('complete_dish_image_generation', {
        p_generation_id: generationRecordId,
        p_success: false,
        p_api_generation_id: null,
        p_error_message: error instanceof Error ? error.message : 'Image generation failed.',
      }).catch(() => undefined);
    }
    return json(
      { error: error instanceof Error ? error.message : 'Image generation failed.' },
      500
    );
  }
});
