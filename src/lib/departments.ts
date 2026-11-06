import { supabase } from '@/lib/supabase';
import type { Department } from '@/types';

const COLUMNS = 'id, restaurant_id, name, is_default, open_time, close_time, system_prompt, is_active, archived, chat_background_asset_id, printer_enabled, printer_name, printer_connection, printer_ip, printer_port, created_at';

interface DepartmentRow {
  id: string;
  restaurant_id: string;
  name: string;
  is_default: boolean;
  open_time: string | null;
  close_time: string | null;
  system_prompt: string;
  is_active: boolean;
  archived: boolean;
  chat_background_asset_id: string | null;
  printer_enabled: boolean;
  printer_name: string | null;
  printer_connection: string | null;
  printer_ip: string | null;
  printer_port: number | null;
  created_at: string;
}

function mapDepartment(row: DepartmentRow): Department {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    isDefault: row.is_default,
    openTime: row.open_time,
    closeTime: row.close_time,
    systemPrompt: row.system_prompt,
    isActive: row.is_active,
    archived: row.archived,
    chatBackgroundAssetId: row.chat_background_asset_id,
    printerEnabled: row.printer_enabled,
    printerName: row.printer_name,
    printerConnection: row.printer_connection === 'wifi' || row.printer_connection === 'lan' ? row.printer_connection : null,
    printerIp: row.printer_ip,
    printerPort: row.printer_port,
    createdAt: row.created_at,
  };
}

export async function listDepartments(restaurantId: string): Promise<Department[]> {
  const { data, error } = await supabase
    .from('departments')
    .select(COLUMNS)
    .eq('restaurant_id', restaurantId)
    .eq('archived', false)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapDepartment(row as DepartmentRow));
}

export async function createDepartment(
  restaurantId: string,
  name: string
): Promise<Department> {
  const { data, error } = await supabase
    .from('departments')
    .insert({ restaurant_id: restaurantId, name })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return mapDepartment(data as DepartmentRow);
}

export async function updateDepartment(
  departmentId: string,
  patch: Partial<Pick<Department, 'name' | 'openTime' | 'closeTime' | 'systemPrompt' | 'isActive' | 'chatBackgroundAssetId' | 'printerEnabled' | 'printerName' | 'printerConnection' | 'printerIp' | 'printerPort'>>
): Promise<Department> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.openTime !== undefined) update.open_time = patch.openTime;
  if (patch.closeTime !== undefined) update.close_time = patch.closeTime;
  if (patch.systemPrompt !== undefined) update.system_prompt = patch.systemPrompt;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;
  if (patch.chatBackgroundAssetId !== undefined) update.chat_background_asset_id = patch.chatBackgroundAssetId;
  if (patch.printerEnabled !== undefined) update.printer_enabled = patch.printerEnabled;
  if (patch.printerName !== undefined) update.printer_name = patch.printerName;
  if (patch.printerConnection !== undefined) update.printer_connection = patch.printerConnection;
  if (patch.printerIp !== undefined) update.printer_ip = patch.printerIp;
  if (patch.printerPort !== undefined) update.printer_port = patch.printerPort;

  const { data, error } = await supabase
    .from('departments')
    .update(update)
    .eq('id', departmentId)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return mapDepartment(data as DepartmentRow);
}

export async function deleteDepartment(departmentId: string): Promise<void> {
  const { error } = await supabase.from('departments').delete().eq('id', departmentId);
  if (error) throw error;
}

export async function archiveDepartment(departmentId: string): Promise<void> {
  const { error } = await supabase
    .from('departments')
    .update({ archived: true, is_active: false, updated_at: new Date().toISOString() })
    .eq('id', departmentId);
  if (error) throw error;
}
