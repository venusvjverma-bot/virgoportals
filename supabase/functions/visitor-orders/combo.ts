import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';
import {
  MAX_REQUEST_CHARS,
  MAX_REQUEST_WORDS,
  parsePriceMinor,
  type DishRow,
  type RemovableIngredientRow,
  type ServingOptionRow,
} from './pricing.ts';

export interface ComboRow {
  id: string;
  restaurant_id: string;
  department_id: string | null;
  event_id: string | null;
  name: string;
  price: string;
  is_active: boolean;
}

export interface ComboGroupRow {
  id: string;
  combo_id: string;
  section: string;
  category: string;
  required_count: number;
  sort_order: number;
}

export interface ComboSelectionInput {
  groupId: string;
  dishId: string;
  servingOptionId?: string | null;
  removedIngredientIds?: string[];
}

export interface ComboSelectionSnapshot {
  groupId: string;
  dishId: string;
  dishName: string;
  servingLabel: string | null;
  removedIngredients: string;
  upgradeMinor: number;
}

export interface ResourceScope {
  departmentId: string | null;
  eventId: string | null;
}

export type ComboPricing =
  | { ok: true; unitMinor: number; selections: ComboSelectionSnapshot[]; additionalRequest: string }
  | { ok: false; error: string };

const fail = (error: string): ComboPricing => ({ ok: false, error });

function sameScope(row: { department_id: string | null; event_id: string | null }, scope: ResourceScope): boolean {
  return (row.department_id ?? null) === scope.departmentId && (row.event_id ?? null) === scope.eventId;
}

function normaliseRequest(value: unknown): string | null {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text.length > MAX_REQUEST_CHARS || text.split(/\s+/).filter(Boolean).length > MAX_REQUEST_WORDS) return null;
  return text;
}

/**
 * Validates one combo line against the live menu and returns the unit price
 * and a snapshot of every chosen dish. The combo price is the base; each
 * serving upgrade adds only the amount by which it exceeds the dish's base price.
 */
export function priceComboLine(args: {
  combo: ComboRow;
  groups: ComboGroupRow[];
  selections: ComboSelectionInput[];
  additionalRequest: unknown;
  dishes: Map<string, DishRow>;
  options: Map<string, ServingOptionRow>;
  ingredients: Map<string, RemovableIngredientRow>;
  scope: ResourceScope;
}): ComboPricing {
  const { combo, groups, selections, dishes, options, ingredients, scope } = args;

  if (!combo.is_active) return fail(`"${combo.name}" is no longer available. Please review your basket.`);
  if (!sameScope(combo, scope)) return fail(`"${combo.name}" is not available here.`);

  const basePrice = parsePriceMinor(combo.price);
  if (basePrice === null) return fail(`Could not determine the price for "${combo.name}".`);

  const requestText = normaliseRequest(args.additionalRequest);
  if (requestText === null) {
    return fail(`The request for "${combo.name}" can be at most ${MAX_REQUEST_WORDS} words.`);
  }

  const groupById = new Map(groups.map((g) => [g.id, g]));
  const counts = new Map<string, number>();
  for (const sel of selections) {
    if (!groupById.has(sel.groupId)) {
      return fail(`The selections for "${combo.name}" are no longer valid. Please review your basket.`);
    }
    counts.set(sel.groupId, (counts.get(sel.groupId) ?? 0) + 1);
  }
  for (const group of groups) {
    if ((counts.get(group.id) ?? 0) !== group.required_count) {
      return fail(`Please complete every selection for "${combo.name}".`);
    }
  }

  let upgradesMinor = 0;
  const snapshots: ComboSelectionSnapshot[] = [];
  for (const sel of selections) {
    const group = groupById.get(sel.groupId)!;
    const dish = dishes.get(sel.dishId);
    if (
      !dish ||
      dish.restaurant_id !== combo.restaurant_id ||
      !dish.available ||
      dish.section !== group.section ||
      dish.category !== group.category ||
      !sameScope(dish, scope)
    ) {
      return fail(`One of the dishes in "${combo.name}" is no longer available. Please review your basket.`);
    }

    const dishBase = parsePriceMinor(dish.price);
    if (dishBase === null) return fail(`Could not determine the price for "${dish.name}".`);

    let upgradeMinor = 0;
    let servingLabel: string | null = null;
    if (sel.servingOptionId) {
      const opt = options.get(sel.servingOptionId);
      if (!opt || opt.dish_id !== dish.id || !opt.is_active) {
        return fail(`The serving option for "${dish.name}" is no longer available. Please review your basket.`);
      }
      const optPrice = parsePriceMinor(opt.price);
      if (optPrice === null) return fail(`Could not determine the price for "${dish.name}".`);
      upgradeMinor = Math.max(0, optPrice - dishBase);
      servingLabel = opt.label;
    }

    const removedLabels: string[] = [];
    for (const ingId of sel.removedIngredientIds ?? []) {
      const ing = ingredients.get(ingId);
      if (!ing || ing.dish_id !== dish.id || !ing.is_active) {
        return fail(`One of the removals for "${dish.name}" is no longer available. Please review your basket.`);
      }
      removedLabels.push(`no ${ing.label}`);
    }

    upgradesMinor += upgradeMinor;
    snapshots.push({
      groupId: group.id,
      dishId: dish.id,
      dishName: dish.name,
      servingLabel,
      removedIngredients: removedLabels.join(', '),
      upgradeMinor,
    });
  }

  return {
    ok: true,
    unitMinor: basePrice + upgradesMinor,
    selections: snapshots,
    additionalRequest: requestText,
  };
}

interface VisitorDishRow {
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

function applyScope<Q extends { eq: (c: string, v: string) => Q; is: (c: string, v: null) => Q }>(
  query: Q,
  scope: ResourceScope,
): Q {
  const scoped = scope.departmentId ? query.eq('department_id', scope.departmentId) : query.is('department_id', null);
  return scope.eventId ? scoped.eq('event_id', scope.eventId) : scoped.is('event_id', null);
}

/** Loads the active combos for one visitor resource, each with its groups and eligible dishes. */
export async function listCombosForScope(
  supabase: SupabaseClient,
  restaurantId: string,
  scope: ResourceScope,
) {
  const { data: combos, error: comboError } = await applyScope(
    supabase
      .from('combos')
      .select('id, name, description, image_url, price, sort_order')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true),
    scope,
  ).order('sort_order', { ascending: true });
  if (comboError) throw comboError;
  if (!combos || combos.length === 0) return [];

  const comboIds = combos.map((c: { id: string }) => c.id);
  const { data: groups, error: groupError } = await supabase
    .from('combo_groups')
    .select('id, combo_id, section, category, required_count, sort_order')
    .in('combo_id', comboIds)
    .order('sort_order', { ascending: true });
  if (groupError) throw groupError;
  const groupRows = (groups ?? []) as ComboGroupRow[];

  const { data: dishes, error: dishError } = await applyScope(
    supabase
      .from('dishes')
      .select('id, restaurant_id, name, description, ingredients, allergy, price, image_url, sort_order, category, section, serving, abv, available, department_id, event_id')
      .eq('restaurant_id', restaurantId)
      .eq('available', true),
    scope,
  ).order('sort_order', { ascending: true });
  if (dishError) throw dishError;
  const dishRows = (dishes ?? []) as VisitorDishRow[];
  const dishIds = dishRows.map((d) => d.id);

  let optionRows: ServingOptionRow[] = [];
  let ingredientRows: RemovableIngredientRow[] = [];
  if (dishIds.length > 0) {
    const { data: options, error: optError } = await supabase
      .from('dish_serving_options')
      .select('id, dish_id, label, price, is_active, sort_order')
      .in('dish_id', dishIds)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (optError) throw optError;
    optionRows = (options ?? []) as ServingOptionRow[];

    const { data: ingredients, error: ingError } = await supabase
      .from('dish_removable_ingredients')
      .select('id, dish_id, label, is_active, sort_order')
      .in('dish_id', dishIds)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (ingError) throw ingError;
    ingredientRows = (ingredients ?? []) as RemovableIngredientRow[];
  }

  return combos.map((c: { id: string; name: string; description: string; image_url: string | null; price: string; sort_order: number }) => ({
    id: c.id,
    name: c.name,
    description: c.description ?? '',
    imageUrl: c.image_url ?? null,
    price: c.price,
    groups: groupRows
      .filter((g) => g.combo_id === c.id)
      .map((g) => ({
        id: g.id,
        section: g.section,
        category: g.category,
        requiredCount: g.required_count,
        dishes: dishRows
          .filter((d) => d.section === g.section && d.category === g.category)
          .map((d) => ({
            id: d.id,
            restaurantId: d.restaurant_id,
            name: d.name,
            description: d.description ?? '',
            ingredients: d.ingredients ?? '',
            allergy: d.allergy ?? '',
            price: d.price,
            imageUrl: d.image_url ?? null,
            sortOrder: d.sort_order,
            category: d.category,
            section: d.section,
            serving: d.serving ?? '',
            abv: d.abv ?? '',
            available: d.available,
            departmentId: d.department_id,
            eventId: d.event_id,
            servingOptions: optionRows
              .filter((o) => o.dish_id === d.id)
              .map((o) => ({ id: o.id, dishId: o.dish_id, label: o.label, price: o.price, sortOrder: 0, isActive: o.is_active })),
            removableIngredients: ingredientRows
              .filter((r) => r.dish_id === d.id)
              .map((r) => ({ id: r.id, dishId: r.dish_id, label: r.label, sortOrder: 0, isActive: r.is_active })),
          })),
      })),
  }));
}
