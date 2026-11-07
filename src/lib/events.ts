import { supabase } from '@/lib/supabase';
import type { EventItem } from '@/types';

const COLUMNS = 'id, restaurant_id, name, start_date, end_date, start_time, end_time, system_prompt, status, chat_background_asset_id, table_service_enabled, table_service_charge, room_service_enabled, room_service_charge, created_at';

interface EventRow {
  id: string;
  restaurant_id: string;
  name: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  system_prompt: string;
  status: string;
  chat_background_asset_id: string | null;
  table_service_enabled: boolean;
  table_service_charge: number;
  room_service_enabled: boolean;
  room_service_charge: number;
  created_at: string;
}

function mapEvent(row: EventRow): EventItem {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    systemPrompt: row.system_prompt,
    status: (['upcoming', 'active', 'ended', 'archived'] as const).includes(
      row.status as EventItem['status']
    )
      ? (row.status as EventItem['status'])
      : 'upcoming',
    chatBackgroundAssetId: row.chat_background_asset_id,
    tableServiceEnabled: row.table_service_enabled,
    tableServiceCharge: row.table_service_charge,
    roomServiceEnabled: row.room_service_enabled,
    roomServiceCharge: row.room_service_charge,
    createdAt: row.created_at,
  };
}

export async function listEvents(restaurantId: string): Promise<EventItem[]> {
  const { data, error } = await supabase
    .from('events')
    .select(COLUMNS)
    .eq('restaurant_id', restaurantId)
    .neq('status', 'archived')
    .order('start_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapEvent(row as EventRow));
}

export async function createEvent(
  restaurantId: string,
  data: { name: string; startDate: string; endDate: string; startTime: string | null; endTime: string | null }
): Promise<EventItem> {
  const { data: row, error } = await supabase
    .from('events')
    .insert({
      restaurant_id: restaurantId,
      name: data.name,
      start_date: data.startDate,
      end_date: data.endDate,
      start_time: data.startTime,
      end_time: data.endTime,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return mapEvent(row as EventRow);
}

export async function updateEvent(
  eventId: string,
  patch: Partial<
    Pick<
      EventItem,
      'name' | 'startDate' | 'endDate' | 'startTime' | 'endTime' | 'systemPrompt' | 'status' | 'chatBackgroundAssetId' | 'tableServiceEnabled' | 'tableServiceCharge' | 'roomServiceEnabled' | 'roomServiceCharge'
    >
  >
): Promise<EventItem> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.startDate !== undefined) update.start_date = patch.startDate;
  if (patch.endDate !== undefined) update.end_date = patch.endDate;
  if (patch.startTime !== undefined) update.start_time = patch.startTime;
  if (patch.endTime !== undefined) update.end_time = patch.endTime;
  if (patch.systemPrompt !== undefined) update.system_prompt = patch.systemPrompt;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.chatBackgroundAssetId !== undefined) update.chat_background_asset_id = patch.chatBackgroundAssetId;
  if (patch.tableServiceEnabled !== undefined) update.table_service_enabled = patch.tableServiceEnabled;
  if (patch.tableServiceCharge !== undefined) update.table_service_charge = patch.tableServiceCharge;
  if (patch.roomServiceEnabled !== undefined) update.room_service_enabled = patch.roomServiceEnabled;
  if (patch.roomServiceCharge !== undefined) update.room_service_charge = patch.roomServiceCharge;

  const { data, error } = await supabase
    .from('events')
    .update(update)
    .eq('id', eventId)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return mapEvent(data as EventRow);
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) throw error;
}

export async function closeEvent(eventId: string): Promise<void> {
  const { error } = await supabase.rpc('close_event', { p_event_id: eventId });
  if (error) throw error;
}

export async function archiveEvent(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', eventId);
  if (error) throw error;
}
