import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';

export interface ResourceScope {
  departmentId: string | null;
  eventId: string | null;
}

interface ComboRow {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: string;
  sort_order: number;
}

interface ComboGroupRow {
  id: string;
  combo_id: string;
  section: string;
  category: string;
  required_count: number;
  sort_order: number;
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

interface OptionRow {
  id: string;
  dish_id: string;
  label: string;
  price: string;
  is_active: boolean;
  sort_order: number;
}

interface IngredientRow {
  id: string;
  dish_id: string;
  label: string;
  is_active: boolean;
  sort_order: number;
}

function applyScope<Q extends { eq: (c: string, v: string) => Q; is: (c: string, v: null) => Q }>(
  query: Q,
  scope: ResourceScope,
): Q {
  const scoped = scope.departmentId ? query.eq('department_id', scope.departmentId) : query.is('department_id', null);
  return scope.eventId ? scoped.eq('event_id', scope.eventId) : scoped.is('event_id', null);
}

/**
 * Display-only copy of the visitor combo loader used by the order function.
 * The order function still validates every selection when an order is placed.
 */
export async function listCombosForScope(supabase: SupabaseClient, restaurantId: string, scope: ResourceScope) {
  const { data: combos, error: comboError } = await applyScope(
    supabase
      .from('combos')
      .select('id, name, description, image_url, price, sort_order')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true),
    scope,
  ).order('sort_order', { ascending: true });
  if (comboError) throw comboError;
  const comboRows = (combos ?? []) as ComboRow[];
  if (comboRows.length === 0) return [];

  const { data: groups, error: groupError } = await supabase
    .from('combo_groups')
    .select('id, combo_id, section, category, required_count, sort_order')
    .in('combo_id', comboRows.map((c) => c.id))
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

  let optionRows: OptionRow[] = [];
  let ingredientRows: IngredientRow[] = [];
  if (dishIds.length > 0) {
    const { data: options, error: optError } = await supabase
      .from('dish_serving_options')
      .select('id, dish_id, label, price, is_active, sort_order')
      .in('dish_id', dishIds)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (optError) throw optError;
    optionRows = (options ?? []) as OptionRow[];

    const { data: ingredients, error: ingError } = await supabase
      .from('dish_removable_ingredients')
      .select('id, dish_id, label, is_active, sort_order')
      .in('dish_id', dishIds)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (ingError) throw ingError;
    ingredientRows = (ingredients ?? []) as IngredientRow[];
  }

  return comboRows.map((c) => ({
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
              .map((o) => ({ id: o.id, dishId: o.dish_id, label: o.label, price: o.price, sortOrder: o.sort_order, isActive: o.is_active })),
            removableIngredients: ingredientRows
              .filter((r) => r.dish_id === d.id)
              .map((r) => ({ id: r.id, dishId: r.dish_id, label: r.label, sortOrder: r.sort_order, isActive: r.is_active })),
          })),
      })),
  }));
}
