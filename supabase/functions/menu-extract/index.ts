import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { extractText, getDocumentProxy } from 'npm:unpdf@1.8.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

type Section = 'food' | 'drinks' | 'add_on';

const FOOD_CATEGORIES = [
  'starters_appetizers',
  'main_courses',
  'soups',
  'salads',
  'sides',
  'desserts',
  'kids_menu',
  'specials',
] as const;

const DRINK_CATEGORIES = [
  'coffee_tea',
  'soft_drinks_water',
  'juices',
  'mocktails',
  'cocktails',
  'beer_cider',
  'wine',
  'spirits_shots',
  'non_alcoholic_beer',
] as const;

const ADD_ON_CATEGORIES = ['food_add_ons', 'drink_add_ons', 'add_ons'] as const;

const CATEGORIES = [...FOOD_CATEGORIES, ...DRINK_CATEGORIES, ...ADD_ON_CATEGORIES] as const;
type Category = (typeof CATEGORIES)[number];
const CATEGORY_SET = new Set<string>(CATEGORIES);
const FOOD_CATEGORY_SET = new Set<string>(FOOD_CATEGORIES);
const DRINK_CATEGORY_SET = new Set<string>(DRINK_CATEGORIES);

/**
 * A menu is far longer than a single answer, so the reply is not capped by the
 * Admin's answer-length setting. A 1,500-token cap truncated the JSON mid-array
 * on a real 41-item food-and-drinks menu, which then parsed to nothing and was
 * reported as "no dishes found".
 *
 * Measured against that same 41-item menu: 1,500 tokens lost every drink
 * description, while 12,000 tokens returned all 41 items with their details
 * intact. The floor is therefore set to the measured value rather than the
 * answer-length setting, which still applies to ordinary visitor replies.
 */
const EXTRACTION_MIN_TOKENS = 12000;
const EXTRACTION_MAX_TOKENS = 16000;
const MENU_TEXT_LIMIT = 60000;

interface ModelConfig {
  provider?: string;
  apiKey?: string;
  model?: string;
  endpoint?: string;
  reasoningEnabled?: boolean | null;
  maxOutputTokens?: number | null;
}

type Db = ReturnType<typeof createClient>;

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

interface DishDraft {
  name: string;
  section: Section;
  category: Category;
  description: string;
  ingredients: string;
  allergy: string;
  price: string;
  serving: string;
  abv: string;
  variantOf: string;
  variant: string;
  additionalPrice: string;
}

interface VariantOption {
  serving: string;
  price: string;
}

interface VariantChoice {
  name: string;
  additionalPrice: string;
}

interface GroupedDraft {
  draft: DishDraft;
  variants: VariantOption[];
}

/**
 * Normalizes a product name for clustering size variants: lowercase, strip
 * diacritics, collapse whitespace, drop surrounding quotes, and ignore
 * trailing punctuation. "Coca-Cola" and "coca cola" should match; "Coca-Cola
 * Zero" must NOT match "Coca-Cola" because the extra word differs.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.:;,]+$/g, '')
    .trim();
}

/**
 * Expands one line that lists several sizes with slashes, such as "25 cl / 50 cl"
 * priced "SEK 74 / 114", into one draft per size. A line is only split when its
 * size and price parts line up one to one and every size names a unit, so a
 * fraction like "1/2 l" is left alone.
 */
function splitCombinedDrafts(drafts: DishDraft[]): DishDraft[] {
  return drafts.flatMap((draft) => {
    if (!draft.serving.includes('/') || !draft.price.includes('/')) return [draft];
    const servings = draft.serving.split('/').map((part) => part.trim());
    const prices = draft.price.split('/').map((part) => part.trim());
    if (servings.length < 2 || servings.length !== prices.length) return [draft];
    if (servings.some((part) => !/[a-z]/i.test(part)) || prices.some((part) => part.length === 0)) {
      return [draft];
    }
    return servings.map((serving, index) => ({ ...draft, serving, price: prices[index] }));
  });
}

/**
 * Groups drafts that are the same product in several serving sizes. Drafts are
 * matched on normalized name, section and category only, so differing wording
 * in description or ingredients for one drink does not split its sizes. Names
 * that differ ("Coca-Cola" vs "Coca-Cola Zero") never merge.
 *
 * A draft with no serving size is never merged: there is no size to offer, so it
 * stays a standalone dish with its own price and no size label is invented.
 * The first sized draft becomes the representative dish row, its serving is
 * cleared (sizes now live in dish_serving_options) and its price is kept as the
 * headline price. Later members contribute their serving and price as options,
 * in document order.
 */
function groupDraftsByVariant(drafts: DishDraft[]): GroupedDraft[] {
  const groups: GroupedDraft[] = [];
  const keyToIndex = new Map<string, number>();

  for (const draft of drafts) {
    const serving = draft.serving.trim();
    if (serving.length === 0) {
      groups.push({ draft, variants: [] });
      continue;
    }

    const identityKey = [normalizeName(draft.name), draft.section, draft.category].join('\u0000');
    const existingIndex = keyToIndex.get(identityKey);
    if (existingIndex === undefined) {
      keyToIndex.set(identityKey, groups.length);
      groups.push({ draft, variants: [] });
      continue;
    }

    const group = groups[existingIndex];
    if (group.variants.some((v) => v.serving === serving) || serving === group.draft.serving.trim()) {
      groups.push({ draft, variants: [] });
      continue;
    }
    group.variants.push({ serving, price: draft.price.trim() });
  }

  return groups;
}

function isVariantLine(draft: DishDraft): boolean {
  return (
    draft.section !== 'add_on' &&
    draft.variantOf.length > 0 &&
    normalizeName(draft.variantOf) !== normalizeName(draft.name) &&
    /\d/.test(draft.additionalPrice)
  );
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function normalizedValue(value: unknown): string {
  return asString(value).toLowerCase().replace(/[&/]/g, '_').replace(/[\s-]+/g, '_');
}

function asSection(value: unknown, evidence: string): Section {
  const text = normalizedValue(value);
  if (text === 'add_on' || text === 'add_ons' || text === 'addon' || text === 'addons') return 'add_on';
  if (text === 'drinks' || text === 'drink' || text === 'beverage' || text === 'beverages') return 'drinks';
  if (text === 'food' || text === 'foods') return 'food';
  const lower = evidence.toLowerCase();
  return /(cocktail|beer|lager|wine|whisky|whiskey|vodka|gin|rum|tequila|coffee|tea|juice|soda|water|mocktail|drink)/.test(lower)
    ? 'drinks'
    : 'food';
}

function asCategory(value: unknown, section: Section, evidence: string): Category {
  if (section === 'add_on') {
    const addOnCategory = normalizedValue(value);
    return addOnCategory === 'food_add_ons' || addOnCategory === 'drink_add_ons' ? addOnCategory : 'add_ons';
  }
  const text = normalizedValue(value);
  const aliases: Record<string, Category> = {
    food: 'main_courses',
    cocktail: 'cocktails',
    beer: 'beer_cider',
    cider: 'beer_cider',
    spirit: 'spirits_shots',
    spirits: 'spirits_shots',
    shots: 'spirits_shots',
    non_alcoholic_drink: 'non_alcoholic_beer',
    non_alcoholic: 'non_alcoholic_beer',
    coffee: 'coffee_tea',
    tea: 'coffee_tea',
    starter: 'starters_appetizers',
    appetizer: 'starters_appetizers',
    main: 'main_courses',
    dessert: 'desserts',
    kids: 'kids_menu',
  };
  const candidate = aliases[text] ?? text;
  const allowed = section === 'food' ? FOOD_CATEGORY_SET : DRINK_CATEGORY_SET;
  if (allowed.has(candidate) && CATEGORY_SET.has(candidate)) return candidate as Category;

  const lower = evidence.toLowerCase();
  if (section === 'drinks') {
    if (/(non[- ]?alcoholic|alcohol[- ]?free).*(beer|lager)|(beer|lager).*(non[- ]?alcoholic|alcohol[- ]?free)/.test(lower)) return 'non_alcoholic_beer';
    if (/(coffee|tea|espresso|cappuccino|latte)/.test(lower)) return 'coffee_tea';
    if (/(juice|smoothie)/.test(lower)) return 'juices';
    if (/(mocktail|virgin mojito|alcohol[- ]?free cocktail)/.test(lower)) return 'mocktails';
    if (/(cocktail|martini|margarita|mojito|spritz|highball|daiquiri|sour)/.test(lower)) return 'cocktails';
    if (/(beer|lager|ale|ipa|pilsner|cider)/.test(lower)) return 'beer_cider';
    if (/(wine|champagne|prosecco|sauvignon|chardonnay)/.test(lower)) return 'wine';
    if (/(vodka|gin|whisky|whiskey|rum|tequila|brandy|cognac|spirit|shot)/.test(lower)) return 'spirits_shots';
    if (/(water|soda|soft drink|cola|tonic)/.test(lower)) return 'soft_drinks_water';
    return 'soft_drinks_water';
  }
  if (/(soup|chowder|tom yum|tom kha)/.test(lower)) return 'soups';
  if (/(salad|papaya|som tam)/.test(lower)) return 'salads';
  if (/(dessert|cake|ice cream|sticky rice)/.test(lower)) return 'desserts';
  if (/(fries|fry|rice|carrot|side)/.test(lower)) return 'sides';
  if (/(starter|appetizer|satay|spring roll|larb)/.test(lower)) return 'starters_appetizers';
  return 'main_courses';
}

function extractionTokens(configured: unknown): number {
  const value = Number(configured);
  if (!Number.isFinite(value) || value <= 0) return EXTRACTION_MIN_TOKENS;
  return Math.min(Math.max(Math.round(value), EXTRACTION_MIN_TOKENS), EXTRACTION_MAX_TOKENS);
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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Pulls the array out of a reply that may be fenced, prefaced with prose, or
 * cut off at the token limit. A truncated tail is repaired by dropping the
 * last, incomplete object and closing the array, so a long menu that only
 * slightly overran is still usable instead of being thrown away entirely.
 */
function extractJsonArray(text: string): { items: unknown[]; truncated: boolean } {
  const cleaned = text.replace(/```json/gi, '```').trim();
  const fenced = cleaned.match(/```([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : cleaned;

  const start = candidate.indexOf('[');
  if (start === -1) return { items: [], truncated: false };

  const end = candidate.lastIndexOf(']');
  if (end > start) {
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1));
      return { items: Array.isArray(parsed) ? parsed : [], truncated: false };
    } catch {
      // fall through to repair
    }
  }

  const body = candidate.slice(start + 1);
  const lastClose = body.lastIndexOf('}');
  if (lastClose === -1) return { items: [], truncated: true };

  try {
    const parsed = JSON.parse(`[${body.slice(0, lastClose + 1)}]`);
    return { items: Array.isArray(parsed) ? parsed : [], truncated: true };
  } catch {
    return { items: [], truncated: true };
  }
}

/**
 * Extracts a non-negative integer token count from a provider's usage metadata
 * field. Returns null when the value is missing or not a valid number, so the
 * caller can skip the llm_usage insert rather than fabricate a count.
 */
function extractTokenCount(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function extractionInstruction(): string {
  return (
    'You are reading a restaurant menu and returning structured data.\n' +
    'Extract EVERY item in the document, including food AND drinks.\n' +
    'Cocktails, beer, wine, spirits, shots, soft drinks, coffee and tea are all items. ' +
    'Never skip an item because it is a drink.\n\n' +
    'Return ONLY a JSON array. No prose, no markdown fences.\n' +
    'Each element must be an object with exactly these keys:\n' +
    '  "name"        - the item name as printed\n' +
    '  "section"     - exactly one of: food, drinks, add_on\n' +
    '  "category"    - exactly one approved category belonging to that section. ' +
    'Food: starters_appetizers, main_courses, soups, salads, sides, desserts, kids_menu, specials. ' +
    'Drinks: coffee_tea, soft_drinks_water, juices, mocktails, cocktails, beer_cider, wine, ' +
    'spirits_shots, non_alcoholic_beer. Add-on items: food_add_ons or drink_add_ons, or add_ons when you cannot tell.\n' +
    '  "price"       - price including currency as printed, e.g. "SEK 149"\n' +
    '  "description" - the item description, or ""\n' +
    '  "ingredients" - ingredients or composition, or ""\n' +
    '  "allergy"     - allergens, ONLY when the document states them for that item, or ""\n' +
    '  "serving"     - serving size or volume as printed, e.g. "40 cl", or ""\n' +
    '  "abv"         - alcohol percentage as printed, e.g. "5.0%", or ""\n' +
    '  "variant_of"  - for a named option of another item, the exact name of that parent item as printed, or ""\n' +
    '  "variant"     - the option name as printed, or ""\n' +
    '  "additional_price" - the extra amount the option adds, ONLY when the menu prints it as an add-on with a plus sign, or ""\n\n' +
    'Sizes: when one item is offered in several sizes or volumes, return ONE object per size. ' +
    'Every object for that item must repeat the same "name", "section", "category", "description", ' +
    '"ingredients", "allergy" and "abv" text, and only "serving" and "price" may differ. ' +
    'Never combine sizes into one object. A line such as "25 cl / 50 cl" priced "SEK 74 / 114" ' +
    'becomes two objects: serving "25 cl" with price "SEK 74", and serving "50 cl" with price "SEK 114". ' +
    'If an item has a price but no printed size, use serving "" and keep its own object. ' +
    'Never guess a size from the item name.\n\n' +
    'Add-ons: an add-on is an optional extra the guest can add on top of other items, such as a topping, sauce, side or extra portion, usually printed under its own heading or with a plus sign. ' +
    'Return each add-on as its own object with section "add_on". Set category "food_add_ons" when the add-on is a food extra and "drink_add_ons" when it is a drink extra, judging by the add-on itself and the menu context around it. ' +
    'When you cannot tell with confidence, use category "add_ons" so the restaurant can review it. Never guess. Keep each add-on own name, description and printed price. ' +
    'Do not attach add-ons as variants, do not set "variant_of", and do not put add-on prices in "additional_price". ' +
    'Several add-ons may exist, and each is a separate object.\n\n' +
    'Variants: when a menu lists a named option of an item as its own line, ' +
    'set "variant_of" to the parent item name, "variant" to the option name, and "additional_price" only when the menu prints an add-on amount for it. ' +
    'A full price printed for the option line is not an add-on amount: leave "variant_of", "variant" and "additional_price" as "" and keep the line as its own object. ' +
    'The parent keeps its own object and its own price.\n\n' +
    'Choose Section first, then choose a Category belonging to that Section. Use the original ' +
    'heading and surrounding context as evidence, but classify the item by what it actually is ' +
    'using its name, description, ingredients and preparation details. A Drinks heading may contain ' +
    'coffee or a non-alcoholic beer; do not copy the heading as the category. If uncertain, choose ' +
    'the most plausible approved category; the host will review it. Examples: curry → food/main_courses, ' +
    'soup → food/soups, cappuccino → drinks/coffee_tea, virgin mojito → drinks/mocktails, ' +
    'non-alcoholic lager → drinks/non_alcoholic_beer, fries → food/sides.\n\n' +
    'Use an empty string "" for any field the document does not state. ' +
    'Never invent prices, ingredients, allergens, serving sizes or alcohol ' +
    'percentages, and never carry an allergen over from a different item.'
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    const restaurantId = body?.restaurantId as string | undefined;
    const objectPath = (body?.objectPath as string | undefined) ?? '';
    const mimeType = (body?.mimeType as string | undefined) ?? '';
    const fileName = (body?.fileName as string | undefined) ?? '';
    const departmentId = body?.departmentId as string | undefined;
    const eventId = body?.eventId as string | undefined;

    if (!restaurantId) return json({ error: 'Missing restaurant.' }, 400);
    if (!objectPath) return json({ error: 'No menu file was uploaded.' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceKey);

    const userId = await verifyUser(supabase, req);
    if (!userId) return json({ error: 'Please sign in to continue.' }, 401);

    // Ownership is verified against the database, not the request body, so a
    // caller cannot extract a menu into a restaurant they do not own.
    const { data: owned, error: ownerError } = await supabase
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .eq('owner_id', userId)
      .maybeSingle();
    if (ownerError) throw ownerError;
    if (!owned) return json({ error: 'This restaurant is not on your account.' }, 403);

    // The caller must name a file inside their own restaurant's folder in the
    // private menu-files bucket. No path traversal, no other host's file, and no
    // arbitrary URL, because the object is read from the bucket with the service
    // role rather than fetched from a caller-supplied address.
    const safePath = objectPath.replace(/^\/+/, '');
    if (
      safePath.includes('..') ||
      !safePath.startsWith(`${restaurantId}/`) ||
      safePath.length > 300
    ) {
      return json({ error: 'That file does not belong to your restaurant.' }, 403);
    }

    const { data: configRow, error: configError } = await supabase
      .from('model_settings')
      .select('provider, api_key, model, endpoint, reasoning_enabled, max_output_tokens')
      .eq('key', 'chatModel')
      .maybeSingle();
    if (configError) throw configError;

    const chat: ModelConfig = {
      provider: configRow?.provider ?? '',
      apiKey: configRow?.api_key ?? '',
      model: configRow?.model ?? '',
      endpoint: configRow?.endpoint ?? '',
      reasoningEnabled: configRow?.reasoning_enabled ?? false,
      maxOutputTokens: configRow?.max_output_tokens ?? null,
    };
    if (!chat.apiKey || !chat.endpoint || !chat.model) {
      return json({ error: 'Admin has not set the chat model' }, 400);
    }

    // The bucket is private, so the document is downloaded with the service
    // role from the bucket directly rather than through a public URL.
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('menu-files')
      .download(safePath);
    if (downloadError || !fileBlob) {
      return json(
        { error: 'Could not download the uploaded menu file. Try uploading it again.' },
        502
      );
    }
    const bytes = new Uint8Array(await fileBlob.arrayBuffer());
    if (bytes.length === 0) {
      return json({ error: 'That file is empty. Upload a menu photo or PDF.' }, 422);
    }

    const isPdf = mimeType === 'application/pdf' || /\.pdf$/i.test(fileName);
    const isImage = mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(fileName);

    if (!isPdf && !isImage) {
      return json(
        {
          error:
            'That file type is not supported. Upload a PDF menu or a photo of the menu (JPG or PNG).',
        },
        400
      );
    }

    let menuText = '';
    if (isPdf) {
      try {
        const pdf = await getDocumentProxy(bytes);
        const result = await extractText(pdf, { mergePages: true });
        menuText = Array.isArray(result.text) ? result.text.join('\n\n') : String(result.text ?? '');
      } catch {
        return json(
          {
            error:
              'That PDF could not be opened. It may be corrupted or password protected. Try re-saving it or upload a photo instead.',
          },
          422
        );
      }
      if (menuText.trim().length < 5) {
        return json(
          {
            error:
              'That PDF has no selectable text, so it looks like a scanned or image-only file. Upload a photo of the menu instead so it can be read.',
          },
          422
        );
      }
    }

    const instruction = extractionInstruction();
    const userParts: unknown[] = [];
    if (isImage) {
      userParts.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${bytesToBase64(bytes)}` },
      });
      userParts.push({ type: 'text', text: instruction });
    } else {
      userParts.push({
        type: 'text',
        text: `${instruction}\n\n--- MENU TEXT ---\n${menuText.slice(0, MENU_TEXT_LIMIT)}`,
      });
    }

    const requestBody: Record<string, unknown> = {
      model: chat.model,
      temperature: 0,
      max_tokens: extractionTokens(chat.maxOutputTokens),
      messages: [
        { role: 'system', content: 'You read restaurant menus and return structured JSON.' },
        { role: 'user', content: userParts },
      ],
    };
    if (
      chat.endpoint.includes('venice.ai') ||
      (chat.provider ?? '').toLowerCase().includes('venice')
    ) {
      requestBody.reasoning = { enabled: chat.reasoningEnabled === true };
    }

    const aiResponse = await fetch(chat.endpoint, {
      method: 'POST',
      headers: providerHeaders(chat.provider ?? '', chat.apiKey),
      body: JSON.stringify(requestBody),
    });

    if (!aiResponse.ok) {
      const detail = await aiResponse.text().catch(() => '');
      return json(
        {
          error: `The chat model could not read this menu (HTTP ${aiResponse.status}).`,
          detail: detail.slice(0, 300),
        },
        502
      );
    }

    let aiPayload: {
      choices?: Array<{ message?: { content?: unknown } }>;
      usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown };
    } | null = null;
    try {
      aiPayload = await aiResponse.json();
    } catch {
      return json(
        {
          error:
            'The chat model returned a response that could not be read. Try uploading the menu again.',
        },
        502
      );
    }

    const raw = aiPayload?.choices?.[0]?.message?.content;
    const rawText = typeof raw === 'string' ? raw : Array.isArray(raw) ? JSON.stringify(raw) : '';
    if (!rawText.trim()) {
      return json(
        { error: 'The chat model returned an empty response for this menu. Try again.' },
        502
      );
    }

    const { items, truncated } = extractJsonArray(rawText);

    const drafts: DishDraft[] = items
      .map((item) => {
        const record = (item ?? {}) as Record<string, unknown>;
        const name = asString(record.name);
        const evidence = [
          name,
          asString(record.section),
          asString(record.description),
          asString(record.ingredients),
        ].join(' ');
        const section = asSection(record.section, evidence);
        return {
          name,
          section,
          category: asCategory(record.category, section, evidence),
          description: asString(record.description),
          ingredients: asString(record.ingredients),
          allergy: asString(record.allergy),
          price: asString(record.price),
          serving: asString(record.serving),
          abv: asString(record.abv),
          variantOf: asString(record.variant_of),
          variant: asString(record.variant),
          additionalPrice: asString(record.additional_price).replace(/^\+\s*/, ''),
        };
      })
      .filter((dish) => dish.name.length > 0);

    if (drafts.length === 0) {
      if (truncated) {
        return json(
          {
            error:
              'This menu is very long and the reading was cut off before any item could be saved. Split the menu into smaller files and upload them one at a time.',
          },
          422
        );
      }
      return json(
        {
          error:
            'No menu items were recognized in that file. If the menu is a photo, try a sharper, straighter picture; if it is a PDF, make sure it is not a scan without selectable text.',
        },
        422
      );
    }

    const scopeDepartmentId = departmentId || null;
    const scopeEventId = eventId || null;

    const { data: lastDish } = await supabase
      .from('dishes')
      .select('sort_order')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const base = (lastDish?.sort_order ?? -1) + 1;

    let existingQuery = supabase.from('dishes').select('name').eq('restaurant_id', restaurantId);
    existingQuery = scopeDepartmentId
      ? existingQuery.eq('department_id', scopeDepartmentId)
      : existingQuery.is('department_id', null);
    existingQuery = scopeEventId ? existingQuery.eq('event_id', scopeEventId) : existingQuery.is('event_id', null);
    const { data: existing, error: existingError } = await existingQuery;
    if (existingError) throw existingError;
    const existingNames = new Set((existing ?? []).map((row) => normalizeName(String(row.name ?? ''))));

    const variantLines = drafts.filter(isVariantLine);
    const grouped = groupDraftsByVariant(splitCombinedDrafts(drafts.filter((draft) => !isVariantLine(draft))));
    const freshPlain = grouped.filter((group) => !existingNames.has(normalizeName(group.draft.name)));

    const attachments = new Map<GroupedDraft, VariantChoice[]>();
    const unattached: DishDraft[] = [];
    for (const line of variantLines) {
      const matches = freshPlain.filter(
        (group) =>
          group.draft.section === line.section && normalizeName(group.draft.name) === normalizeName(line.variantOf)
      );
      if (matches.length !== 1) {
        unattached.push(line);
        continue;
      }
      const choices = attachments.get(matches[0]) ?? [];
      choices.push({ name: line.variant || line.name, additionalPrice: line.additionalPrice });
      attachments.set(matches[0], choices);
    }
    const standalone = unattached
      .filter((line) => !existingNames.has(normalizeName(line.name)))
      .map((draft): GroupedDraft => ({ draft, variants: [] }));
    const fresh = [...freshPlain, ...standalone];
    const skipped = grouped.length + unattached.length - fresh.length;

    const payload = fresh.map((group) => {
      const dish = group.draft;
      const hasVariants = group.variants.length > 0;
      // The representative's own serving and price become the first size option,
      // so every size of a grouped drink is preserved.
      const options = hasVariants
        ? [
            { label: dish.serving.trim(), price: dish.price },
            ...group.variants.map((variant) => ({ label: variant.serving, price: variant.price })),
          ]
        : [];
      return {
        name: dish.name,
        section: dish.section,
        category: dish.category,
        description: dish.description,
        ingredients: dish.ingredients,
        allergy: dish.allergy,
        // The headline price stays on the dish row so cards without sizes display
        // as before. For grouped drinks the visitor UI prefers the size prices.
        price: dish.price,
        // Sizes for grouped drinks live in dish_serving_options, so the row's
        // serving text is cleared to avoid a misleading duplicate.
        serving: hasVariants ? '' : dish.serving,
        abv: dish.abv,
        options,
      };
    });

    const choicesPerDish = fresh.map((group) => attachments.get(group) ?? []);

    let savedRows: Array<Record<string, unknown>> = [];
    if (payload.length > 0) {
      const { data, error: saveError } = await supabase.rpc('save_extracted_menu_dishes', {
        p_restaurant_id: restaurantId,
        p_department_id: scopeDepartmentId,
        p_event_id: scopeEventId,
        p_base_sort: base,
        p_dishes: payload,
      });
      if (saveError) throw saveError;
      savedRows = (data ?? []) as Array<Record<string, unknown>>;
    }

    const variantRows = savedRows.flatMap((row, index) =>
      (choicesPerDish[index] ?? []).map((choice, sortOrder) => ({
        dish_id: row.id,
        name: choice.name,
        additional_price: choice.additionalPrice,
        sort_order: sortOrder,
      }))
    );
    if (variantRows.length > 0) {
      const { error: variantError } = await supabase.from('dish_variants').insert(variantRows);
      if (variantError) throw variantError;
    }

    await supabase.from('usage_events').insert({ restaurant_id: restaurantId, kind: 'upload' });

    const inputTokens = extractTokenCount(aiPayload?.usage?.prompt_tokens);
    const outputTokens = extractTokenCount(aiPayload?.usage?.completion_tokens);
    if (inputTokens !== null && outputTokens !== null) {
      await supabase
        .from('llm_usage')
        .insert({ restaurant_id: restaurantId, input_tokens: inputTokens, output_tokens: outputTokens })
        .then(() => undefined);
    }

    const saved = savedRows.map((row) => {
      return {
        ...row,
        section: row.section ?? 'food',
        category: row.category ?? 'main_courses',
      };
    });

    return json({ dishes: saved, truncated, skipped });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Menu reading failed.' },
      500
    );
  }
});
