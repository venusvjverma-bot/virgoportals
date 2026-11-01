import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

/**
 * Upper bound on cards in one reply. A menu that lists food and drinks together
 * is far longer than a food-only list, so the cap is set high enough that a
 * genuine "show me the whole menu" returns everything rather than a truncated
 * slice of it.
 */
const MAX_CARDS = 100;
const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_CHARS = 2000;
const MAX_MESSAGE_CHARS = 1000;
const MAX_HISTORY_ENTRIES = 40;

/**
 * Server-enforced abuse limits for the public chat. The counters live in the
 * database (via the `consume_rate_limit` function), not in memory, because edge
 * function instances do not share memory and a client-supplied counter cannot be
 * trusted. Both limits are checked before any provider call is made.
 */
const IP_WINDOW_SECONDS = 60;
const IP_MAX_PER_WINDOW = 20;
const RESTAURANT_WINDOW_SECONDS = 60;
const RESTAURANT_MAX_PER_WINDOW = 120;

const SUPPORTED_LANGUAGES = new Set([
  'English', 'Svenska', '中文', 'हिन्दी', 'العربية',
  'Español', 'Français', 'Deutsch', 'Italiano', 'Português',
  'Polski', 'Suomi', 'Türkçe', '日本語', 'Русский',
]);

interface ModelConfig {
  provider?: string;
  apiKey?: string;
  model?: string;
  endpoint?: string;
  reasoningEnabled?: boolean | null;
  temperature?: number | string | null;
  maxOutputTokens?: number | null;
}

interface DishRow {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  ingredients: string;
  allergy: string;
  price: string;
  image_url: string | null;
  category?: string | null;
  section?: string | null;
  serving?: string | null;
  abv?: string | null;
  available?: boolean | null;
}

const SECTION_LABELS: Record<string, string> = {
  food: 'Food',
  drinks: 'Drinks',
  add_on: 'Add-on',
};

const CATEGORY_LABELS: Record<string, string> = {
  starters_appetizers: 'Starters / Appetizers',
  main_courses: 'Main Courses',
  soups: 'Soups',
  salads: 'Salads',
  sides: 'Sides',
  desserts: 'Desserts',
  kids_menu: "Kids' Menu",
  specials: 'Specials',
  coffee_tea: 'Coffee & Tea',
  soft_drinks_water: 'Soft Drinks & Water',
  juices: 'Juices',
  mocktails: 'Mocktails',
  cocktails: 'Cocktails',
  beer_cider: 'Beer & Cider',
  wine: 'Wine',
  spirits_shots: 'Spirits & Shots',
  non_alcoholic_beer: 'Non-alcoholic Beer',
};

function sectionLabel(section: string | null | undefined): string {
  return SECTION_LABELS[(section ?? '').toLowerCase()] ?? SECTION_LABELS.food;
}

function categoryLabel(category: string | null | undefined): string {
  return CATEGORY_LABELS[(category ?? '').toLowerCase()] ?? CATEGORY_LABELS.main_courses;
}

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

interface ServingOptionRow {
  id: string;
  dish_id: string;
  label: string;
  price: string;
  sort_order: number;
  is_active: boolean;
}

interface RemovableIngredientRow {
  id: string;
  dish_id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

interface BasketItemInput {
  name: string;
  price: string;
  quantity: number;
  servingLabel?: string | null;
}

interface ResourceRow {
  resource_name: string;
  resource_type: string;
  open_time: string | null;
  close_time: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  restaurant_name: string;
  city: string | null;
  welcome: string | null;
  timezone: string | null;
}

/**
 * Formats department/event metadata into a context block so the LLM can answer
 * questions about the resource name, opening hours, event dates, and timezone.
 * Returns an empty string when no resource is scoped.
 */
function buildResourceContext(row: ResourceRow | null): string {
  if (!row) return '';
  const lines: string[] = [];
  const resourceType = row.resource_type === 'event' ? 'Event' : 'Department';
  lines.push(`You are assisting guests at the following ${resourceType.toLowerCase()}:`);
  lines.push(`${resourceType} name: ${row.resource_name}`);
  lines.push(`Restaurant: ${row.restaurant_name}`);
  if (row.city) lines.push(`City: ${row.city}`);
  const tz = row.timezone || 'Europe/Stockholm';
  lines.push(`Timezone: ${tz}`);
  if (row.resource_type === 'department') {
    const open = row.open_time;
    const close = row.close_time;
    if (open && close) {
      lines.push(`Opening hours: ${open} – ${close} (${tz})`);
    } else {
      lines.push('Opening hours: Always open');
    }
  } else if (row.resource_type === 'event') {
    const dateRange = row.start_date && row.end_date
      ? `${row.start_date}${row.start_date !== row.end_date ? ' – ' + row.end_date : ''}`
      : (row.start_date || row.end_date || '');
    if (dateRange) lines.push(`Dates: ${dateRange}`);
    const timeRange = row.start_time && row.end_time
      ? `${row.start_time} – ${row.end_time}`
      : (row.start_time || row.end_time || '');
    if (timeRange) lines.push(`Times: ${timeRange} (${tz})`);
  }
  lines.push('Answer questions about opening hours, dates, times, and the department/event name using the information above. If hours are listed as "Always open", tell the guest the department is always open.');
  return lines.join('\n');
}

/**
 * The visitor UI reads `imageUrl`, but the dishes table column is `image_url`,
 * so the row is mapped to the shape the UI expects before it is returned.
 */
function toCard(
  dish: DishRow,
  servingOptions: ServingOptionRow[] = [],
  removableIngredients: RemovableIngredientRow[] = [],
  currency = 'SEK'
) {
  return {
    id: dish.id,
    name: dish.name,
    section: dish.section ?? 'food',
    category: dish.category ?? 'main_courses',
    description: dish.description,
    ingredients: dish.ingredients,
    allergy: dish.allergy,
    price: dish.price,
    imageUrl: dish.image_url,
    serving: dish.serving ?? '',
    abv: dish.abv ?? '',
    available: dish.available !== false,
    restaurantId: dish.restaurant_id,
    currency,
    servingOptions: servingOptions
      .filter((o) => o.is_active)
      .map((o) => ({ id: o.id, dishId: o.dish_id, label: o.label, price: o.price, sortOrder: o.sort_order, isActive: o.is_active })),
    removableIngredients: removableIngredients
      .filter((i) => i.is_active)
      .map((i) => ({ id: i.id, dishId: i.dish_id, label: i.label, sortOrder: i.sort_order, isActive: i.is_active })),
  };
}

/**
 * Parses a price text like "120 SEK", "150,00 kr", "$15.50", "95.00" into
 * integer minor units. Returns null if no number can be extracted.
 */
function parsePriceMinor(priceText: string): number | null {
  if (!priceText || typeof priceText !== 'string') return null;
  let s = priceText.trim().replace(/[^0-9.,]/g, '');
  if (!s) return null;
  const commaIdx = s.lastIndexOf(',');
  const dotIdx = s.lastIndexOf('.');
  if (commaIdx > dotIdx) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (dotIdx >= 0 && commaIdx >= 0 && commaIdx < dotIdx) {
    s = s.replace(/,/g, '');
  } else if (commaIdx >= 0 && dotIdx < 0) {
    const after = s.length - commaIdx - 1;
    if (after <= 2) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
  }
  const num = parseFloat(s);
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 100);
}

/**
 * Formats the visitor's current basket into a context block so the LLM can
 * answer questions about what the guest has already added. Prices are parsed
 * into minor units and rendered with the restaurant's currency. Returns an
 * empty string when the basket is empty.
 */
function buildBasketContext(items: BasketItemInput[], currency = 'SEK'): string {
  const valid = Array.isArray(items)
    ? items.filter(
        (i) => i && typeof i.name === 'string' && Number.isInteger(i.quantity) && i.quantity > 0
      ).slice(0, 50)
    : [];
  if (valid.length === 0) return '';

  const lines: string[] = ['--- VISITOR BASKET ---', 'The guest has already added these items:'];
  let totalMinor = 0;
  for (const item of valid) {
    const priceMinor = parsePriceMinor(item.price);
    const safePrice = priceMinor ?? 0;
    totalMinor += safePrice * item.quantity;
    const serving = item.servingLabel ? ` (${item.servingLabel})` : '';
    const lineTotal = formatMinorUnits(safePrice * item.quantity, currency);
    const unitPrice = formatMinorUnits(safePrice, currency);
    lines.push(`- ${item.name}${serving}: ${item.quantity} x ${unitPrice} = ${lineTotal}`);
  }
  lines.push(`Basket total: ${formatMinorUnits(totalMinor, currency)}`);
  lines.push('Use this information if the guest asks about their basket, total, or what they have ordered.');
  return lines.join('\n');
}

function formatMinorUnits(minor: number, currency: string): string {
  const localeMap: Record<string, string> = {
    SEK: 'sv-SE', NOK: 'nb-NO', DKK: 'da-DK', EUR: 'de-DE', USD: 'en-US',
    GBP: 'en-GB', INR: 'en-IN', CHF: 'de-CH', CAD: 'en-CA', AUD: 'en-AU',
  };
  const code = currency && localeMap[currency] ? currency : 'SEK';
  const locale = localeMap[code] ?? 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${code}`;
  }
}

function buildMenuContext(dishes: DishRow[], optionsByDish: Map<string, ServingOptionRow[]>, currency = 'SEK'): string {
  if (dishes.length === 0) return 'This restaurant has not saved any dishes yet.';
  const header = `All prices are in ${currency}.`;
  return header + '\n\n' + dishes
    .map((dish) => {
      const lines = [
        `Item: ${dish.name}`,
        `Section: ${sectionLabel(dish.section)}`,
        `Category: ${categoryLabel(dish.category)}`,
      ];
      const opts = (optionsByDish.get(dish.id) ?? []).filter((o) => o.is_active);
      if (opts.length > 0) {
        lines.push(`Serving options:`);
        for (const opt of opts) {
          lines.push(`  - ${opt.label}: ${opt.price}`);
        }
      } else if (dish.price) {
        lines.push(`Price: ${dish.price}`);
      }
      if (dish.description) lines.push(`Description: ${dish.description}`);
      if (dish.ingredients) lines.push(`Ingredients: ${dish.ingredients}`);
      if (dish.allergy) lines.push(`Allergy: ${dish.allergy}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

/**
 * Card selection is a backend decision, so the model only has to name the
 * dishes it used. Anything it names is resolved against this restaurant's own
 * saved rows before a card is returned, so a made-up or foreign name can never
 * become a card.
 */
function cardInstructions(): string {
  return (
    'CARD SELECTION\n' +
    'Finish every reply with one final line naming the dishes the guest should see as cards, ' +
    'copied exactly from the item names above:\n' +
    'CARDS: <exact item name>, <exact item name>\n' +
    'Use CARDS: ALL when the guest asks for the whole menu or everything you have. ' +
    'When the guest asks for a specific section (Drinks, Food or Add-on), name every item in that section only and do not include items from the other sections. ' +
    'Use CARDS: none when no card is useful, such as a greeting, a general question, ' +
    'or an item that is not on the menu.\n' +
    'Always include the item the guest is currently asking about, and keep the item from the ' +
    'previous turn when the guest asks a follow-up about it ("it", "that one", "the first one"). ' +
    'For a recommendation, name only the alternatives you actually suggest. ' +
    'When the guest asks about a section or category, use the Section and Category ' +
    'labels in the menu context. For cocktails, beer, wine, spirits, or other ' +
    'drink categories, name every saved item of that category. ' +
    'Never name an item that is not in the list above.\n' +
    'When an item has serving options listed, mention the available sizes and prices. ' +
    'Never invent serving sizes or prices that are not listed in the menu context.\n\n' +
    'FOLLOWUP SELECTION\n' +
    'When you list one or more dishes on the CARDS line, add one more final line ' +
    'with a short follow-up message for the guest:\n' +
    'FOLLOWUP: <your follow-up message>\n' +
    'Omit the FOLLOWUP line entirely when the CARDS line is none.\n\n' +
    'SUGGESTION BUBBLES\n' +
    'Always finish with one final line containing up to two clickable ' +
    'suggestion prompts the guest might want to ask next:\n' +
    'SUGGESTIONS: <prompt>, <prompt>\n' +
    'The content, wording, and behaviour of these suggestions must follow the ' +
    'restaurant\u2019s system prompt above. Use the conversation history, the guest\u2019s ' +
    'current topic, and the VISITOR BASKET block as context, but let the system ' +
    'prompt decide what the suggestions say. Each suggestion must be a concise, ' +
    'complete, guest-readable prompt in the same language as your reply. ' +
    'Write SUGGESTIONS: none only when the system prompt indicates no further ' +
    'suggestion is appropriate.'
  );
}

function suggestionsInstructions(): string {
  return (
    'SUGGESTION BUBBLES ONLY\n' +
    'Do not write a chat reply. Do not include CARDS or FOLLOWUP lines. ' +
    'Output exactly one line containing up to two clickable suggestion prompts ' +
    'the guest might want to ask next:\n' +
    'SUGGESTIONS: <prompt>, <prompt>\n' +
    'The content, wording, and behaviour of these suggestions must follow the ' +
    'restaurant\u2019s system prompt above. Use the conversation history, the guest\u2019s ' +
    'current topic, and the VISITOR BASKET block as context, but let the system ' +
    'prompt decide what the suggestions say. Each suggestion must be a concise, ' +
    'complete, guest-readable prompt in the same language as the conversation. ' +
    'Write SUGGESTIONS: none only when the system prompt indicates no further ' +
    'suggestion is appropriate.'
  );
}

function normalizeHistory(value: unknown): HistoryMessage[] {
  if (!Array.isArray(value)) return [];
  const cleaned: HistoryMessage[] = [];
  for (const entry of value.slice(0, MAX_HISTORY_ENTRIES)) {
    const record = (entry ?? {}) as Record<string, unknown>;
    const role =
      record.role === 'assistant' ? 'assistant' : record.role === 'user' ? 'user' : null;
    const content = typeof record.content === 'string' ? record.content.trim() : '';
    if (!role || !content) continue;
    cleaned.push({ role, content: content.slice(0, MAX_HISTORY_CHARS) });
  }
  return cleaned.slice(-MAX_HISTORY_MESSAGES);
}

/** Best-effort client address from the proxy headers the platform sets. */
function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') ?? '';
  const first = forwarded.split(',')[0]?.trim();
  return first || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
}

/**
 * Pulls the CARDS and FOLLOWUP directive lines out of the reply and strips them
 * from the prose. Both use the same leading-keyword convention so they work
 * with every plain-text provider without requiring JSON mode.
 */
const MAX_SUGGESTIONS = 2;

function extractDirectives(text: string): {
  reply: string;
  cardsDirective: string | null;
  followUp: string | null;
  suggestions: string[];
} {
  const kept: string[] = [];
  let cardsDirective: string | null = null;
  let followUp: string | null = null;
  let suggestionsDirective: string | null = null;
  for (const line of text.split('\n')) {
    const cardMatch = line.match(/^\s*(?:\*\*)?CARDS(?:\*\*)?\s*:\s*(.*)$/i);
    const followMatch = line.match(/^\s*(?:\*\*)?FOLLOWUP(?:\*\*)?\s*:\s*(.*)$/i);
    const suggestMatch = line.match(/^\s*(?:\*\*)?SUGGESTIONS(?:\*\*)?\s*:\s*(.*)$/i);
    if (cardMatch) {
      cardsDirective = cardMatch[1].replace(/\*\*/g, '').trim();
    } else if (followMatch) {
      followUp = followMatch[1].replace(/\*\*/g, '').trim();
    } else if (suggestMatch) {
      suggestionsDirective = suggestMatch[1].replace(/\*\*/g, '').trim();
    } else {
      kept.push(line);
    }
  }
  return {
    reply: kept.join('\n').trim(),
    cardsDirective,
    followUp,
    suggestions: parseSuggestions(suggestionsDirective),
  };
}

/** Parses the SUGGESTIONS directive into a clean, de-duplicated list. */
function parseSuggestions(directive: string | null): string[] {
  if (!directive) return [];
  if (/^(none|no suggestions|nothing|-)$/i.test(directive.trim())) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of directive.split(/[,;]+/)) {
    const clean = raw.replace(/^\s*\d+[.)]\s*/, '').trim().replace(/\*\*/g, '').trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out.slice(0, MAX_SUGGESTIONS);
}

function resolveDirective(directive: string, menu: DishRow[], sectionFilter: string[] | null = null): DishRow[] {
  const value = directive.trim().replace(/^\[|\]$/g, '').trim();
  if (!value || /^(none|no cards|nothing|-)$/i.test(value)) return [];

  const scopedMenu = sectionFilter && sectionFilter.length > 0
    ? menu.filter((d) => sectionFilter.includes((d.section ?? 'food').toLowerCase()))
    : menu;

  if (/^(all|everything|full menu|entire menu|whole menu)$/i.test(value)) {
    return scopedMenu.slice(0, MAX_CARDS);
  }

  const picked: DishRow[] = [];
  for (const raw of value.split(/[,;]+/)) {
    const wanted = raw.replace(/^\d+[.)]\s*/, '').trim().toLowerCase();
    if (!wanted || /^(none|no cards|nothing|-)$/.test(wanted)) continue;

    const exact = scopedMenu.find((dish) => dish.name.trim().toLowerCase() === wanted);
    if (exact) {
      if (!picked.includes(exact)) picked.push(exact);
      continue;
    }

    // The model may shorten or reword a name, so fall back to a one-way
    // containment check. The result is still one of this restaurant's rows.
    const loose = scopedMenu.find((dish) => {
      const name = dish.name.trim().toLowerCase();
      return name.length > 2 && (name.includes(wanted) || wanted.includes(name));
    });
    if (loose && !picked.includes(loose)) picked.push(loose);
  }
  return picked.slice(0, MAX_CARDS);
}

/**
 * Extracts a non-negative integer token count from a provider's usage metadata
 * field. Returns null when the value is missing or not a valid number, so the
 * caller can skip the llm_usage insert rather than fabricate a count.
 */
const SECTION_SYNONYMS: Record<string, string[]> = {
  drinks: [
    'drinks', 'drink', 'beverages', 'beverage', 'bar',
    'cocktail', 'cocktails', 'beer', 'beers', 'wine', 'wines',
    'spirits', 'spirit', 'shots', 'shot', 'alcohol', 'alcoholic',
    'liquor', 'liqueur', 'ale', 'lager', 'stout', 'cider',
    'mocktail', 'mocktails', 'juice', 'juices', 'smoothie', 'smoothies',
    'soft drink', 'soft drinks', 'soda', 'water', 'coffee', 'tea',
    'latte', 'espresso', 'cappuccino', 'cappucino',
    // Swedish
    'drycker', 'dryck', 'öl', 'vin', 'viner', 'drinkar',
    'sprit', 'alkohol', 'alkoholfritt', 'läsk', 'läskedrycker',
    'vatten', 'kaffe', 'te', 'juicer',
  ],
  add_on: [
    'add-on', 'add-ons', 'add on', 'add ons', 'addon', 'addons', 'extras',
    // Swedish
    'tillägg', 'tillval',
  ],
  food: [
    'food', 'eat', 'eating', 'meal', 'meals', 'hungry', 'appetite',
    'starters', 'appetizers', 'mains', 'main courses', 'soups', 'soup',
    'salads', 'salad', 'sides', 'side dishes', 'desserts', 'dessert',
    'kids menu', 'specials', 'entrees', 'entree', 'courses', 'course',
    'cuisine', 'grill', 'grilled', 'fried', 'baked', 'roasted',
    'sandwich', 'sandwiches', 'burger', 'burgers', 'pasta', 'pizza',
    'steak', 'chicken', 'beef', 'pork', 'fish', 'seafood',
    'vegetarian', 'vegan', 'gluten', 'lactose',
    // Swedish
    'mat', 'maten', 'rätter', 'rätt', 'äta', 'ätande', 'hungrig',
    'förrätter', 'förrätt', 'huvudrätter', 'huvudrätt',
    'soppa', 'sallad', 'sallader', 'efterrätter', 'efterrätt',
    'grillat', 'stekt', 'friterad', 'rostat',
    'smörgås', 'burgare', 'biff', 'kyckling', 'fläsk',
    'fisk', 'skaldjur', 'vegetarisk', 'vegan', 'gluten', 'laktos',
  ],
};

/**
 * Detects which menu section(s) the visitor is asking about from their message.
 * Returns null when no section is identifiable (no filter applied). Returns
 * ['drinks'], ['food'], or ['food', 'drinks'] when one or both sections are
 * detected. The backend uses this to enforce that only items whose saved
 * section field matches are returned as cards.
 */
function detectRequestedSections(message: string): string[] | null {
  const lower = message.toLowerCase();
  const detected: string[] = [];
  for (const [section, keywords] of Object.entries(SECTION_SYNONYMS)) {
    for (const kw of keywords) {
      const pattern = kw.includes(' ') ? kw : `\\b${kw}\\b`;
      if (new RegExp(pattern, 'i').test(lower)) {
        detected.push(section);
        break;
      }
    }
  }
  return detected.length > 0 ? detected : null;
}

function extractTokenCount(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    const restaurantId = body?.restaurantId as string | undefined;
    const resourceId = body?.resourceId as string | undefined;
    const resourceType = body?.resourceType as string | undefined;
    const message = (body?.message as string | undefined)?.trim();
    const language = (body?.language as string | undefined)?.trim() ?? '';
    const validLanguage = SUPPORTED_LANGUAGES.has(language) ? language : '';
    const basketItems = Array.isArray(body?.basket) ? (body.basket as BasketItemInput[]) : [];
    const suggestionsOnly = Boolean(body?.suggestionsOnly);

    if (!restaurantId) return json({ error: 'Missing restaurant.' }, 400);
    if (!suggestionsOnly && !message) return json({ error: 'Type a question first.' }, 400);
    if (message && message.length > MAX_MESSAGE_CHARS) {
      return json({ error: 'That message is too long. Please shorten it.' }, 413);
    }

    const hasResource = Boolean(resourceId && resourceType && (resourceType === 'department' || resourceType === 'event'));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Server-side abuse limits. Both are enforced before the provider is called,
    // and the counters are durable so they hold across function instances.
    const ip = clientIp(req);
    const [ipOk, restaurantOk] = await Promise.all([
      supabase.rpc('consume_rate_limit', {
        p_key: `chat:ip:${ip}`,
        p_limit: IP_MAX_PER_WINDOW,
        p_window_seconds: IP_WINDOW_SECONDS,
      }),
      supabase.rpc('consume_rate_limit', {
        p_key: `chat:restaurant:${restaurantId}`,
        p_limit: RESTAURANT_MAX_PER_WINDOW,
        p_window_seconds: RESTAURANT_WINDOW_SECONDS,
      }),
    ]);
    if (ipOk.error) throw ipOk.error;
    if (restaurantOk.error) throw restaurantOk.error;
    if (ipOk.data !== true || restaurantOk.data !== true) {
      return json(
        {
          error:
            'Too many questions in a short time. Please wait a moment and try again.',
        },
        429
      );
    }

    let effectiveSystemPrompt = '';
    let resourceRow: ResourceRow | null = null;
    let restaurantCurrency = 'SEK';

    if (hasResource) {
      const { data: resource, error: resourceError } = await supabase
        .rpc('get_public_resource', { p_resource_id: resourceId, p_resource_type: resourceType })
        .maybeSingle();
      if (resourceError) throw resourceError;
      if (!resource) return json({ error: 'This menu was not found.' }, 404);
      const row = resource as Record<string, unknown>;
      effectiveSystemPrompt = String(row.system_prompt ?? '').trim();
      restaurantCurrency = String(row.currency ?? 'SEK');
      resourceRow = {
        resource_name: String(row.resource_name ?? ''),
        resource_type: String(row.resource_type ?? resourceType),
        open_time: (row.open_time as string | null) ?? null,
        close_time: (row.close_time as string | null) ?? null,
        start_date: (row.start_date as string | null) ?? null,
        end_date: (row.end_date as string | null) ?? null,
        start_time: (row.start_time as string | null) ?? null,
        end_time: (row.end_time as string | null) ?? null,
        restaurant_name: String(row.restaurant_name ?? ''),
        city: (row.city as string | null) ?? null,
        welcome: (row.welcome as string | null) ?? null,
        timezone: (row.timezone as string | null) ?? null,
      };
    } else {
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('id, name, system_prompt, currency')
        .eq('id', restaurantId)
        .maybeSingle();
      if (restaurantError) throw restaurantError;
      if (!restaurant) return json({ error: 'This restaurant portal was not found.' }, 404);
      effectiveSystemPrompt = restaurant.system_prompt?.trim() ?? '';
      restaurantCurrency = restaurant.currency ?? 'SEK';
    }

    let dishes;
    let dishesError;
    if (hasResource && resourceType === 'department') {
      ({ data: dishes, error: dishesError } = await supabase
        .from('dishes')
        .select('id, restaurant_id, name, description, ingredients, allergy, price, image_url, section, category, serving, abv, available')
        .eq('restaurant_id', restaurantId)
        .eq('department_id', resourceId)
        .order('sort_order', { ascending: true }));
    } else if (hasResource && resourceType === 'event') {
      ({ data: dishes, error: dishesError } = await supabase
        .from('dishes')
        .select('id, restaurant_id, name, description, ingredients, allergy, price, image_url, section, category, serving, abv, available')
        .eq('restaurant_id', restaurantId)
        .eq('event_id', resourceId)
        .order('sort_order', { ascending: true }));
    } else {
      ({ data: dishes, error: dishesError } = await supabase
        .from('dishes')
        .select('id, restaurant_id, name, description, ingredients, allergy, price, image_url, section, category, serving, abv, available')
        .eq('restaurant_id', restaurantId)
        .is('department_id', null)
        .is('event_id', null)
        .order('sort_order', { ascending: true }));
    }
    if (dishesError) throw dishesError;

    const { data: configRow, error: configError } = await supabase
      .from('model_settings')
      .select('provider, api_key, model, endpoint, reasoning_enabled, temperature, max_output_tokens')
      .eq('key', 'chatModel')
      .maybeSingle();
    if (configError) throw configError;

    const chat: ModelConfig = {
      provider: configRow?.provider ?? '',
      apiKey: configRow?.api_key ?? '',
      model: configRow?.model ?? '',
      endpoint: configRow?.endpoint ?? '',
      reasoningEnabled: configRow?.reasoning_enabled ?? false,
      temperature: configRow?.temperature ?? 0.8,
      maxOutputTokens: configRow?.max_output_tokens ?? 1500,
    };
    if (!chat.apiKey || !chat.endpoint || !chat.model) {
      return json({ error: 'Admin has not set the chat model' }, 400);
    }

    // ── Credit gate: block LLM calls when the host has zero credits ──
    // The service role bypasses RLS, so this reads the authoritative balance.
    // Both regular chat and suggestions-only calls consume tokens, so both are gated.
    const { data: creditBalance, error: creditError } = await supabase
      .rpc('check_host_credit', { p_restaurant_id: restaurantId });
    if (creditError) throw creditError;
    const availableCredits = Number(creditBalance ?? 0);
    if (availableCredits <= 0) {
      return json(
        { error: 'This restaurant has no LLM credits remaining. Please ask the Virgo team to add credits.' },
        403
      );
    }

    const menu = ((dishes ?? []) as DishRow[]).filter((d) => d.available !== false);

    // ── Fetch serving options for all menu dishes ──
    const optionsByDish = new Map<string, ServingOptionRow[]>();
    const ingredientsByDish = new Map<string, RemovableIngredientRow[]>();
    if (menu.length > 0) {
      const dishIds = menu.map((d) => d.id);
      const [servingResult, ingredientResult] = await Promise.all([
        supabase
          .from('dish_serving_options')
          .select('id, dish_id, label, price, sort_order, is_active')
          .in('dish_id', dishIds)
          .order('sort_order', { ascending: true }),
        supabase
          .from('dish_removable_ingredients')
          .select('id, dish_id, label, sort_order, is_active')
          .in('dish_id', dishIds)
          .order('sort_order', { ascending: true }),
      ]);
      if (servingResult.error) throw servingResult.error;
      if (ingredientResult.error) throw ingredientResult.error;
      for (const opt of (servingResult.data ?? []) as ServingOptionRow[]) {
        const list = optionsByDish.get(opt.dish_id) ?? [];
        list.push(opt);
        optionsByDish.set(opt.dish_id, list);
      }
      for (const ing of (ingredientResult.data ?? []) as RemovableIngredientRow[]) {
        const list = ingredientsByDish.get(ing.dish_id) ?? [];
        list.push(ing);
        ingredientsByDish.set(ing.dish_id, list);
      }
    }

    const systemPrompt =
      effectiveSystemPrompt ||
      'You are the restaurant host\u2019s menu assistant. Answer only from this restaurant\u2019s saved menu.';
    const resourceContext = buildResourceContext(resourceRow);
    const resourceBlock = resourceContext ? `${resourceContext}\n\n` : '';
    const langInstruction = validLanguage
      ? `\nAlways respond to the guest in ${validLanguage}, regardless of what language they type in.`
      : '';
    const basketContext = buildBasketContext(basketItems, restaurantCurrency);
    const basketBlock = basketContext ? `\n\n${basketContext}\n\n` : '';

    const menuContextText = buildMenuContext(menu, optionsByDish, restaurantCurrency);
    const requestBody: Record<string, unknown> = {
      model: chat.model,
      temperature: Number(chat.temperature ?? 0.8),
      max_tokens: suggestionsOnly
        ? Math.min(Number(chat.maxOutputTokens ?? 1500), 300)
        : Number(chat.maxOutputTokens ?? 1500),
      messages: suggestionsOnly
        ? [
            {
              role: 'system',
              content:
                `${resourceBlock}${systemPrompt}\n\n` +
                `You are generating suggestion bubbles for the guest based on the conversation so far ` +
                `and the current contents of their basket. Do not write a chat reply, do not select ` +
                `product cards, and do not include CARDS or FOLLOWUP lines.\n\n` +
                `${suggestionsInstructions()}\n\n` +
                `${langInstruction}\n\n` +
                `--- SAVED MENU ---\n${menuContextText}` +
                basketBlock,
            },
            ...normalizeHistory(body?.history),
            {
              role: 'user',
              content:
                'The guest\u2019s basket has been updated. Based on the conversation history above and the current basket contents, suggest up to two helpful prompts the guest might want to ask next.',
            },
          ]
        : [
            {
              role: 'system',
              content:
                `${resourceBlock}${systemPrompt}\n\nYou may only use the menu below. Never take orders or payments. ` +
                `If a guest asks for something not on the menu, say so politely. ` +
                `The menu lists food, drinks and add-ons; each item is labelled with its type, so ` +
                `answer drink questions from the same list.\n\n` +
                `${cardInstructions()}\n\n` +
                `${langInstruction}\n\n` +
                `--- SAVED MENU ---\n${menuContextText}` +
                basketBlock,
            },
            ...normalizeHistory(body?.history),
            { role: 'user', content: message },
          ],
    };

    // Venice reasoning models think before answering by default, which adds ~15-30s
    // per visitor reply. For OpenAI reasoning models proxied through Venice (e.g.
    // GPT-5.6 Luna Pro), the { enabled } boolean is a no-op; the real control is the
    // OpenAI-compatible `reasoning_effort` string. Admin Disabled maps to "low" and
    // Enabled to "medium". Venice-native reasoning models keep the boolean switch.
    // Only Venice is sent these parameters; other providers never agreed to accept them.
    const isVenice = chat.endpoint.includes('venice.ai') || (chat.provider ?? '').toLowerCase().includes('venice');
    if (isVenice) {
      if (chat.model.includes('luna-pro')) {
        requestBody.reasoning_effort = chat.reasoningEnabled === true ? 'medium' : 'low';
      } else {
        requestBody.reasoning = { enabled: chat.reasoningEnabled === true };
      }
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
          error: `The chat model could not answer right now (${aiResponse.status}).`,
          detail: detail.slice(0, 300),
        },
        502
      );
    }

    let payload: {
      choices?: Array<{ message?: { content?: unknown } }>;
      usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown };
    } | null = null;
    try {
      payload = await aiResponse.json();
    } catch {
      return json({ error: 'The chat model returned an unreadable response.' }, 502);
    }

    const raw = payload?.choices?.[0]?.message?.content;
    const rawReply = typeof raw === 'string' ? raw.trim() : '';
    if (!rawReply) {
      if (suggestionsOnly) return json({ suggestions: [] });
      return json({ error: 'The chat model returned an empty reply.' }, 502);
    }

    const { reply: prose, cardsDirective, followUp, suggestions } = extractDirectives(rawReply);

    const inputTokens = extractTokenCount(payload?.usage?.prompt_tokens);
    const outputTokens = extractTokenCount(payload?.usage?.completion_tokens);
    if (inputTokens !== null && outputTokens !== null) {
      await supabase
        .from('llm_usage')
        .insert({ restaurant_id: restaurantId, input_tokens: inputTokens, output_tokens: outputTokens })
        .then(() => undefined);

      // ── Deduct credits: 1 credit = 900,000 combined tokens ──
      // The deduction is atomic (FOR UPDATE row lock in the function), so
      // concurrent requests cannot overspend the same balance. The underlying
      // balance keeps full numeric precision; only the display rounds.
      const totalTokens = inputTokens + outputTokens;
      const creditsConsumed = totalTokens / 900000;
      if (creditsConsumed > 0) {
        await supabase
          .rpc('deduct_host_credit', {
            p_restaurant_id: restaurantId,
            p_credits: creditsConsumed,
          })
          .then(() => undefined);
      }
    }

    if (suggestionsOnly) {
      return json({ suggestions });
    }

    const reply = prose || rawReply;
    const requestedSections = detectRequestedSections(message ?? '');
    const matched =
      cardsDirective !== null ? resolveDirective(cardsDirective, menu, requestedSections) : [];

    const followUpText = followUp ?? '';

    await supabase.from('usage_events').insert({ restaurant_id: restaurantId, kind: 'message' });

    return json({ reply, dishes: matched.map((d) => toCard(d, optionsByDish.get(d.id) ?? [], ingredientsByDish.get(d.id) ?? [], restaurantCurrency)), followUp: followUpText, suggestions });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'The assistant failed to reply.' },
      500
    );
  }
});
