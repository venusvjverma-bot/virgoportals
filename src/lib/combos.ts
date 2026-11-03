import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import type { Combo, ComboGroup, VisitorCombo } from '@/types';

const COMBO_COLUMNS = 'id, restaurant_id, department_id, event_id, name, description, image_url, price, sort_order, is_active';
const GROUP_COLUMNS = 'id, combo_id, section, category, required_count, sort_order';

interface ComboRow {
  id: string;
  restaurant_id: string;
  department_id: string | null;
  event_id: string | null;
  name: string;
  description: string;
  image_url: string | null;
  price: string;
  sort_order: number;
  is_active: boolean;
}

interface ComboGroupRow {
  id: string;
  combo_id: string;
  section: string;
  category: string;
  required_count: number;
  sort_order: number;
}

export interface ComboInput {
  name: string;
  description: string;
  price: string;
  departmentId: string | null;
  eventId: string | null;
  isActive: boolean;
}

export interface ComboGroupInput {
  section: string;
  category: string;
  requiredCount: number;
}

function mapGroup(row: ComboGroupRow): ComboGroup {
  return {
    id: row.id,
    comboId: row.combo_id,
    section: row.section,
    category: row.category,
    requiredCount: row.required_count,
    sortOrder: row.sort_order,
  };
}

function mapCombo(row: ComboRow, groups: ComboGroup[]): Combo {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    departmentId: row.department_id,
    eventId: row.event_id,
    name: row.name,
    description: row.description ?? '',
    imageUrl: row.image_url,
    price: row.price,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    groups,
  };
}

export async function listCombos(restaurantId: string): Promise<Combo[]> {
  const { data, error } = await supabase
    .from('combos')
    .select(COMBO_COLUMNS)
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  const comboRows = (data ?? []) as ComboRow[];
  if (comboRows.length === 0) return [];

  const { data: groupData, error: groupError } = await supabase
    .from('combo_groups')
    .select(GROUP_COLUMNS)
    .in('combo_id', comboRows.map((c) => c.id))
    .order('sort_order', { ascending: true });
  if (groupError) throw groupError;
  const groups = (groupData ?? []) as ComboGroupRow[];

  return comboRows.map((row) =>
    mapCombo(row, groups.filter((g) => g.combo_id === row.id).map(mapGroup)),
  );
}

export async function createCombo(restaurantId: string, input: ComboInput, sortOrder: number): Promise<Combo> {
  const { data, error } = await supabase
    .from('combos')
    .insert({
      restaurant_id: restaurantId,
      department_id: input.departmentId,
      event_id: input.eventId,
      name: input.name,
      description: input.description,
      price: input.price,
      is_active: input.isActive,
      sort_order: sortOrder,
    })
    .select(COMBO_COLUMNS)
    .single();
  if (error) throw error;
  return mapCombo(data as ComboRow, []);
}

export async function updateCombo(comboId: string, input: Omit<ComboInput, 'departmentId' | 'eventId'>): Promise<void> {
  const { error } = await supabase
    .from('combos')
    .update({
      name: input.name,
      description: input.description,
      price: input.price,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', comboId);
  if (error) throw error;
}

export async function generateComboImage(restaurantId: string, comboId: string): Promise<string> {
  const result = await callFunction<{ imageUrl?: unknown }>('dish-image', { restaurantId, comboId });
  if (typeof result.imageUrl !== 'string' || result.imageUrl.length === 0) {
    throw new Error('The image was generated but no image address was returned.');
  }
  return result.imageUrl;
}

export async function deleteCombo(comboId: string): Promise<void> {
  const { error } = await supabase.from('combos').delete().eq('id', comboId);
  if (error) throw error;
}

export async function replaceComboGroups(comboId: string, groups: ComboGroupInput[]): Promise<void> {
  const { error: deleteError } = await supabase.from('combo_groups').delete().eq('combo_id', comboId);
  if (deleteError) throw deleteError;
  if (groups.length === 0) return;
  const { error } = await supabase.from('combo_groups').insert(
    groups.map((g, index) => ({
      combo_id: comboId,
      section: g.section,
      category: g.category,
      required_count: g.requiredCount,
      sort_order: index,
    })),
  );
  if (error) throw error;
}

export async function listVisitorCombos(
  restaurantId: string,
  resourceType: string,
  resourceId: string,
): Promise<VisitorCombo[]> {
  const result = await callFunction<{ combos: VisitorCombo[] }>('visitor-orders', {
    action: 'combos',
    restaurantId,
    resourceType,
    resourceId,
  });
  if (!result || !Array.isArray(result.combos)) throw new Error('Could not load combos.');
  return result.combos;
}
