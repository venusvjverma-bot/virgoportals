import { supabase } from '@/lib/supabase';
import type { AddOnOption, Dish, DishServingOption, DishVariant, DishRemovableIngredient, RestaurantPortal, PublicResource, ResourceType } from '@/types';
import type { DailyUsageRow } from '@/lib/dailyTokenUsage';

const RESTAURANT_COLUMNS =
  'id, owner_email, name, city, welcome, system_prompt, status, created_at, timezone, currency, business_name, business_address';
const DISH_COLUMNS =
  'id, restaurant_id, name, description, ingredients, allergy, price, image_url, sort_order, category, section, serving, abv, available, department_id, event_id';

interface RestaurantRow {
  id: string;
  owner_email: string;
  name: string;
  city: string;
  welcome: string;
  system_prompt: string;
  status: string;
  created_at: string;
  timezone: string;
  currency: string;
  business_name: string | null;
  business_address: string | null;
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
  sort_order: number;
  category: string;
  section: string;
  serving: string;
  abv: string;
  available: boolean;
  department_id: string | null;
  event_id: string | null;
}

function mapRestaurant(row: RestaurantRow): RestaurantPortal {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    name: row.name,
    city: row.city,
    welcome: row.welcome,
    systemPrompt: row.system_prompt,
    status: row.status === 'Blocked' ? 'Blocked' : 'Active',
    createdAt: row.created_at,
    timezone: row.timezone ?? 'Europe/Stockholm',
    currency: row.currency ?? 'SEK',
    businessName: row.business_name ?? null,
    businessAddress: row.business_address ?? null,
  };
}

function mapDish(row: DishRow, servingOptions: DishServingOption[] = [], removableIngredients: DishRemovableIngredient[] = []): Dish {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    description: row.description,
    ingredients: row.ingredients,
    allergy: row.allergy,
    price: row.price,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    category: row.category,
    section: row.section ?? 'food',
    serving: row.serving,
    abv: row.abv,
    available: row.available ?? true,
    departmentId: row.department_id,
    eventId: row.event_id,
    servingOptions,
    variants: [],
    removableIngredients,
  };
}

/**
 * The signed-in host's own restaurant. Row level security returns the row only
 * when the account owns it, so this cannot read another host's portal.
 */
export async function getOwnPortal(): Promise<RestaurantPortal | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('restaurants')
    .select(RESTAURANT_COLUMNS)
    .eq('owner_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRestaurant(data as RestaurantRow) : null;
}

export interface PublicPortal {
  id: string;
  name: string;
  city: string;
  welcome: string;
  currency: string;
}

/**
 * Visitor-facing portal lookup. Goes through the `get_public_portal` database
 * function, which returns only the public fields (name, city, welcome) and only
 * for an active restaurant. The visitor never touches the restaurants table.
 */
export async function getPublicPortal(portalId: string): Promise<PublicPortal | null> {
  const { data, error } = await supabase.rpc('get_public_portal', { p_portal_id: portalId });
  if (error) throw error;
  const row = (data as PublicPortal[] | null)?.[0];
  return row ?? null;
}

interface PublicResourceRow {
  resource_id: string;
  resource_name: string;
  resource_type: string;
  open_time: string | null;
  close_time: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  restaurant_id: string;
  restaurant_name: string;
  city: string;
  welcome: string;
  system_prompt: string;
  timezone: string;
  currency: string;
  chat_background_path: string | null;
  table_service_enabled: boolean;
  table_service_charge: number;
  room_service_enabled: boolean;
  room_service_charge: number;
}

function mapPublicResource(row: PublicResourceRow): PublicResource {
  return {
    resourceId: row.resource_id,
    resourceName: row.resource_name,
    resourceType: row.resource_type as ResourceType,
    openTime: row.open_time,
    closeTime: row.close_time,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    restaurantId: row.restaurant_id,
    restaurantName: row.restaurant_name,
    city: row.city,
    welcome: row.welcome,
    systemPrompt: row.system_prompt,
    timezone: row.timezone,
    currency: row.currency ?? 'SEK',
    chatBackgroundPath: row.chat_background_path,
    tableServiceEnabled: row.table_service_enabled ?? false,
    tableServiceCharge: row.table_service_charge ?? 0,
    roomServiceEnabled: row.room_service_enabled ?? false,
    roomServiceCharge: row.room_service_charge ?? 0,
  };
}

/**
 * Visitor-facing resource lookup for department/event-scoped QR destinations.
 * Returns public fields plus the effective system prompt (resource-level or
 * falling back to restaurant-level) and the restaurant's timezone.
 */
export async function getPublicResource(
  resourceId: string,
  resourceType: ResourceType
): Promise<PublicResource | null> {
  const { data, error } = await supabase.rpc('get_public_resource', {
    p_resource_id: resourceId,
    p_resource_type: resourceType,
  });
  if (error) throw error;
  const row = (data as PublicResourceRow[] | null)?.[0];
  return row ? mapPublicResource(row) : null;
}

export async function listPublicAddOns(
  restaurantId: string,
  resourceType: ResourceType,
  resourceId: string | null
): Promise<AddOnOption[]> {
  const { data, error } = await supabase.rpc('get_public_add_ons', {
    p_restaurant_id: restaurantId,
    p_resource_type: resourceType,
    p_resource_id: resourceId,
  });
  if (error) throw error;
  return ((data ?? []) as { id: unknown; name: unknown; price: unknown; image_url: unknown; category: unknown }[])
    .filter((row) => typeof row.id === 'string' && typeof row.name === 'string')
    .map((row) => ({
      id: row.id as string,
      name: row.name as string,
      price: typeof row.price === 'string' ? row.price : '',
      imageUrl: typeof row.image_url === 'string' ? row.image_url : null,
      category: typeof row.category === 'string' ? row.category : 'add_ons',
    }));
}

export async function updatePortal(
  restaurantId: string,
  patch: Partial<
    Pick<
      RestaurantPortal,
      'name' | 'city' | 'welcome' | 'systemPrompt' | 'status' | 'timezone' | 'currency' | 'businessName' | 'businessAddress'
    >
  >
): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.city !== undefined) update.city = patch.city;
  if (patch.welcome !== undefined) update.welcome = patch.welcome;
  if (patch.systemPrompt !== undefined) update.system_prompt = patch.systemPrompt;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.timezone !== undefined) update.timezone = patch.timezone;
  if (patch.currency !== undefined) update.currency = patch.currency;
  if (patch.businessName !== undefined) update.business_name = patch.businessName;
  if (patch.businessAddress !== undefined) update.business_address = patch.businessAddress;

  const { error } = await supabase.from('restaurants').update(update).eq('id', restaurantId);
  if (error) throw error;
}

export async function listDishes(restaurantId: string): Promise<Dish[]> {
  const { data, error } = await supabase
    .from('dishes')
    .select(DISH_COLUMNS)
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  const dishes = (data ?? []).map((row) => mapDish(row as DishRow));
  await fillServingOptions(dishes);
  await fillVariants(dishes);
  await fillRemovableIngredients(dishes);
  return dishes;
}

export async function listDishesByDepartment(departmentId: string): Promise<Dish[]> {
  const { data, error } = await supabase
    .from('dishes')
    .select(DISH_COLUMNS)
    .eq('department_id', departmentId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  const dishes = (data ?? []).map((row) => mapDish(row as DishRow));
  await fillServingOptions(dishes);
  await fillVariants(dishes);
  await fillRemovableIngredients(dishes);
  return dishes;
}

export async function listDishesByEvent(eventId: string): Promise<Dish[]> {
  const { data, error } = await supabase
    .from('dishes')
    .select(DISH_COLUMNS)
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  const dishes = (data ?? []).map((row) => mapDish(row as DishRow));
  await fillServingOptions(dishes);
  await fillVariants(dishes);
  await fillRemovableIngredients(dishes);
  return dishes;
}

export async function updateDish(
  dishId: string,
  patch: Partial<
    Pick<Dish, 'name' | 'description' | 'ingredients' | 'allergy' | 'price' | 'category' | 'section' | 'serving' | 'abv' | 'available'>
  >
): Promise<Dish> {
  const { data, error } = await supabase
    .from('dishes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', dishId)
    .select(DISH_COLUMNS)
    .single();
  if (error) throw error;
  const dish = mapDish(data as DishRow);
  await fillServingOptions([dish]);
  await fillVariants([dish]);
  await fillRemovableIngredients([dish]);
  return dish;
}

interface CreateDishOptions {
  restaurantId: string;
  departmentId?: string | null;
  eventId?: string | null;
}

export async function createDish(
  opts: CreateDishOptions,
  patch: Pick<Dish, 'name' | 'description' | 'ingredients' | 'allergy' | 'price' | 'category' | 'section' | 'serving' | 'abv'>
): Promise<Dish> {
  const { restaurantId, departmentId, eventId } = opts;
  const query = supabase
    .from('dishes')
    .select('sort_order')
    .eq('restaurant_id', restaurantId);

  if (departmentId) {
    query.eq('department_id', departmentId);
  } else if (eventId) {
    query.eq('event_id', eventId);
  } else {
    query.is('department_id', null).is('event_id', null);
  }

  const { data: maxRow } = await query
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (maxRow as { sort_order?: number } | null)?.sort_order != null
    ? (maxRow as { sort_order: number }).sort_order + 1
    : 0;

  const { data, error } = await supabase
    .from('dishes')
    .insert({
      restaurant_id: restaurantId,
      department_id: departmentId ?? null,
      event_id: eventId ?? null,
      name: patch.name,
      description: patch.description,
      ingredients: patch.ingredients,
      allergy: patch.allergy,
      price: patch.price,
      category: patch.category,
      section: patch.section,
      serving: patch.serving,
      abv: patch.abv,
      sort_order: nextSort,
    })
    .select(DISH_COLUMNS)
    .single();
  if (error) throw error;
  const dish = mapDish(data as DishRow);
  await fillServingOptions([dish]);
  await fillVariants([dish]);
  await fillRemovableIngredients([dish]);
  return dish;
}

export async function deleteDish(dishId: string): Promise<void> {
  const { error } = await supabase.from('dishes').delete().eq('id', dishId);
  if (error) throw error;
}

// ─── Serving option helpers ───

const SERVING_OPTION_COLUMNS = 'id, dish_id, label, price, quantity, unit, sort_order, is_active';

interface ServingOptionRow {
  id: string;
  dish_id: string;
  label: string;
  price: string;
  quantity: number | null;
  unit: string | null;
  sort_order: number;
  is_active: boolean;
}

function mapServingOption(row: ServingOptionRow): DishServingOption {
  return {
    id: row.id,
    dishId: row.dish_id,
    label: row.label,
    price: row.price,
    quantity: row.quantity,
    unit: (row.unit === 'cl' || row.unit === 'ml' || row.unit === 'oz') ? row.unit : null,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

export async function listServingOptionsByDish(dishIds: string[]): Promise<Map<string, DishServingOption[]>> {
  const optionsByDish = new Map<string, DishServingOption[]>();
  if (dishIds.length === 0) return optionsByDish;
  const { data, error } = await supabase
    .from('dish_serving_options')
    .select(SERVING_OPTION_COLUMNS)
    .in('dish_id', dishIds)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  for (const row of (data ?? []) as ServingOptionRow[]) {
    const list = optionsByDish.get(row.dish_id) ?? [];
    list.push(mapServingOption(row));
    optionsByDish.set(row.dish_id, list);
  }
  return optionsByDish;
}

async function fillServingOptions(dishes: Dish[]): Promise<void> {
  if (dishes.length === 0) return;
  let optionsByDish: Map<string, DishServingOption[]>;
  try {
    optionsByDish = await listServingOptionsByDish(dishes.map((d) => d.id));
  } catch {
    return;
  }
  for (const dish of dishes) {
    dish.servingOptions = optionsByDish.get(dish.id) ?? [];
  }
}

export async function listServingOptions(dishId: string): Promise<DishServingOption[]> {
  const { data, error } = await supabase
    .from('dish_serving_options')
    .select(SERVING_OPTION_COLUMNS)
    .eq('dish_id', dishId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapServingOption(row as ServingOptionRow));
}

export async function replaceServingOptions(
  dishId: string,
  options: { id?: string; label: string; price: string; quantity?: number | null; unit?: string | null; sortOrder: number }[]
): Promise<DishServingOption[]> {
  const existing = await listServingOptions(dishId);
  const existingIds = new Set(existing.map((o) => o.id));
  const keptIds = new Set(options.filter((o) => o.id).map((o) => o.id!));
  const toDelete = [...existingIds].filter((id) => !keptIds.has(id));

  if (toDelete.length > 0) {
    const { error: delError } = await supabase
      .from('dish_serving_options')
      .delete()
      .in('id', toDelete);
    if (delError) throw delError;
  }

  const result: DishServingOption[] = [];
  for (const opt of options) {
    if (opt.id && existingIds.has(opt.id)) {
      const { data, error } = await supabase
        .from('dish_serving_options')
        .update({
          label: opt.label,
          price: opt.price,
          quantity: opt.quantity ?? null,
          unit: opt.unit ?? null,
          sort_order: opt.sortOrder,
          updated_at: new Date().toISOString(),
        })
        .eq('id', opt.id)
        .select(SERVING_OPTION_COLUMNS)
        .single();
      if (error) throw error;
      result.push(mapServingOption(data as ServingOptionRow));
    } else {
      const { data, error } = await supabase
        .from('dish_serving_options')
        .insert({
          dish_id: dishId,
          label: opt.label,
          price: opt.price,
          quantity: opt.quantity ?? null,
          unit: opt.unit ?? null,
          sort_order: opt.sortOrder,
        })
        .select(SERVING_OPTION_COLUMNS)
        .single();
      if (error) throw error;
      result.push(mapServingOption(data as ServingOptionRow));
    }
  }
  return result;
}

// ─── Removable ingredient helpers ───

const REMOVABLE_INGREDIENT_COLUMNS = 'id, dish_id, label, sort_order, is_active';

interface RemovableIngredientRow {
  id: string;
  dish_id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

function mapRemovableIngredient(row: RemovableIngredientRow): DishRemovableIngredient {
  return {
    id: row.id,
    dishId: row.dish_id,
    label: row.label,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

async function fillRemovableIngredients(dishes: Dish[]): Promise<void> {
  if (dishes.length === 0) return;
  const dishIds = dishes.map((d) => d.id);
  const { data, error } = await supabase
    .from('dish_removable_ingredients')
    .select(REMOVABLE_INGREDIENT_COLUMNS)
    .in('dish_id', dishIds)
    .order('sort_order', { ascending: true });
  if (error) return;
  const byDish = new Map<string, DishRemovableIngredient[]>();
  for (const row of (data ?? []) as RemovableIngredientRow[]) {
    const list = byDish.get(row.dish_id) ?? [];
    list.push(mapRemovableIngredient(row));
    byDish.set(row.dish_id, list);
  }
  for (const dish of dishes) {
    dish.removableIngredients = byDish.get(dish.id) ?? [];
  }
}

export async function listRemovableIngredients(dishId: string): Promise<DishRemovableIngredient[]> {
  const { data, error } = await supabase
    .from('dish_removable_ingredients')
    .select(REMOVABLE_INGREDIENT_COLUMNS)
    .eq('dish_id', dishId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapRemovableIngredient(row as RemovableIngredientRow));
}

export async function replaceRemovableIngredients(
  dishId: string,
  ingredients: { id?: string; label: string; sortOrder: number }[]
): Promise<DishRemovableIngredient[]> {
  const existing = await listRemovableIngredients(dishId);
  const existingIds = new Set(existing.map((i) => i.id));
  const keptIds = new Set(ingredients.filter((i) => i.id).map((i) => i.id!));
  const toDelete = [...existingIds].filter((id) => !keptIds.has(id));

  if (toDelete.length > 0) {
    const { error: delError } = await supabase
      .from('dish_removable_ingredients')
      .delete()
      .in('id', toDelete);
    if (delError) throw delError;
  }

  const result: DishRemovableIngredient[] = [];
  for (const ing of ingredients) {
    if (ing.id && existingIds.has(ing.id)) {
      const { data, error } = await supabase
        .from('dish_removable_ingredients')
        .update({
          label: ing.label,
          sort_order: ing.sortOrder,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ing.id)
        .select(REMOVABLE_INGREDIENT_COLUMNS)
        .single();
      if (error) throw error;
      result.push(mapRemovableIngredient(data as RemovableIngredientRow));
    } else {
      const { data, error } = await supabase
        .from('dish_removable_ingredients')
        .insert({
          dish_id: dishId,
          label: ing.label,
          sort_order: ing.sortOrder,
        })
        .select(REMOVABLE_INGREDIENT_COLUMNS)
        .single();
      if (error) throw error;
      result.push(mapRemovableIngredient(data as RemovableIngredientRow));
    }
  }
  return result;
}

// ─── Dish variant helpers ───

const DISH_VARIANT_COLUMNS = 'id, dish_id, name, additional_price, sort_order, is_active';

interface DishVariantRow {
  id: string;
  dish_id: string;
  name: string;
  additional_price: string;
  sort_order: number;
  is_active: boolean;
}

function mapDishVariant(row: DishVariantRow): DishVariant {
  return {
    id: row.id,
    dishId: row.dish_id,
    name: row.name,
    additionalPrice: row.additional_price,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

async function fillVariants(dishes: Dish[]): Promise<void> {
  if (dishes.length === 0) return;
  const { data, error } = await supabase
    .from('dish_variants')
    .select(DISH_VARIANT_COLUMNS)
    .in('dish_id', dishes.map((d) => d.id))
    .order('sort_order', { ascending: true });
  if (error) throw error;
  const byDish = new Map<string, DishVariant[]>();
  for (const row of (data ?? []) as DishVariantRow[]) {
    const list = byDish.get(row.dish_id) ?? [];
    list.push(mapDishVariant(row));
    byDish.set(row.dish_id, list);
  }
  for (const dish of dishes) {
    dish.variants = byDish.get(dish.id) ?? [];
  }
}

export async function listVariants(dishId: string): Promise<DishVariant[]> {
  const { data, error } = await supabase
    .from('dish_variants')
    .select(DISH_VARIANT_COLUMNS)
    .eq('dish_id', dishId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapDishVariant(row as DishVariantRow));
}

export async function replaceVariants(
  dishId: string,
  variants: { id?: string; name: string; additionalPrice: string; sortOrder: number }[]
): Promise<DishVariant[]> {
  const existing = await listVariants(dishId);
  const existingIds = new Set(existing.map((v) => v.id));
  const keptIds = new Set(variants.filter((v) => v.id).map((v) => v.id!));
  const toDelete = [...existingIds].filter((id) => !keptIds.has(id));

  if (toDelete.length > 0) {
    const { error: delError } = await supabase.from('dish_variants').delete().in('id', toDelete);
    if (delError) throw delError;
  }

  const result: DishVariant[] = [];
  for (const variant of variants) {
    const values = {
      name: variant.name,
      additional_price: variant.additionalPrice,
      sort_order: variant.sortOrder,
    };
    if (variant.id && existingIds.has(variant.id)) {
      const { data, error } = await supabase
        .from('dish_variants')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', variant.id)
        .select(DISH_VARIANT_COLUMNS)
        .single();
      if (error) throw error;
      result.push(mapDishVariant(data as DishVariantRow));
    } else {
      const { data, error } = await supabase
        .from('dish_variants')
        .insert({ dish_id: dishId, ...values })
        .select(DISH_VARIANT_COLUMNS)
        .single();
      if (error) throw error;
      result.push(mapDishVariant(data as DishVariantRow));
    }
  }
  return result;
}

/**
 * Uploads a menu document to the PRIVATE `menu-files` bucket, under the caller's
 * own restaurant folder. Storage policies reject any path outside that folder,
 * so a host cannot write into another host's namespace.
 */
export async function getLlmUsageTotals(
  restaurantId: string
): Promise<{ inputTokens: number; outputTokens: number }> {
  const { data, error } = await supabase.rpc('get_llm_usage_totals', { p_restaurant_id: restaurantId });
  if (error) throw error;
  const row = (data ?? [])[0];
  return {
    inputTokens: Number(row?.total_input_tokens ?? 0),
    outputTokens: Number(row?.total_output_tokens ?? 0),
  };
}

export async function getLlmUsageDaily(restaurantId: string): Promise<DailyUsageRow[]> {
  const { data, error } = await supabase.rpc('get_llm_usage_daily', { p_restaurant_id: restaurantId });
  if (error) throw error;
  return (data ?? []).map((row: { usage_date: string; daily_input_tokens: number | null; daily_output_tokens: number | null }) => ({
    usageDate: String(row.usage_date),
    inputTokens: Number(row.daily_input_tokens ?? 0),
    outputTokens: Number(row.daily_output_tokens ?? 0),
  }));
}

export async function getHostCreditBalance(restaurantId: string): Promise<number> {
  const { data, error } = await supabase
    .rpc('check_host_credit', { p_restaurant_id: restaurantId });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function uploadMenuFile(
  file: File,
  restaurantId: string
): Promise<{ objectPath: string }> {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const objectPath = `${restaurantId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from('menu-files').upload(objectPath, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw error;
  return { objectPath };
}

/**
 * Visitor-facing dish image lookup for a department or event.
 * Returns up to 12 image URLs for available dishes in the specified resource,
 * via the public `get_public_dish_images` RPC. Used by the welcome screen.
 */
export async function getPublicDishImages(
  resourceId: string,
  resourceType: ResourceType
): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_public_dish_images', {
    p_resource_id: resourceId,
    p_resource_type: resourceType,
  });
  if (error) throw error;
  return ((data ?? []) as { image_url: string | null }[])
    .map((row) => row.image_url)
    .filter((url): url is string => typeof url === 'string' && url.length > 0);
}
