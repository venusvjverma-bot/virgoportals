import { supabase } from '@/lib/supabase';
import type { Department, DepartmentSessionReport, SessionOrder } from '@/types';

interface SessionRow {
  id: string;
  department_id: string;
  started_at: string;
  closed_at: string | null;
}

interface SessionOrderRow {
  id: string;
  session_id: string;
  order_number: string;
  payment_status: string;
  total_minor: number;
  currency: string;
  created_at: string;
}

const SESSION_COLUMNS = 'id, department_id, started_at, closed_at';
const ORDER_COLUMNS = 'id, session_id, order_number, payment_status, total_minor, currency, created_at';

function mapOrder(row: SessionOrderRow): SessionOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    paymentStatus: row.payment_status,
    totalMinor: row.total_minor,
    currency: row.currency,
    createdAt: row.created_at,
  };
}

export async function listDepartmentSessionReports(
  restaurantId: string,
  departments: Department[],
): Promise<DepartmentSessionReport[]> {
  const departmentIds = departments.map((department) => department.id);
  if (departmentIds.length === 0) return [];

  const { data: sessions, error: sessionError } = await supabase
    .from('department_sessions')
    .select(SESSION_COLUMNS)
    .in('department_id', departmentIds)
    .order('started_at', { ascending: false });
  if (sessionError) throw sessionError;

  const sessionRows = (sessions ?? []) as SessionRow[];
  const sessionIds = sessionRows.map((session) => session.id);
  const { data: orders, error: orderError } = sessionIds.length
    ? await supabase.from('orders').select(ORDER_COLUMNS).in('session_id', sessionIds).order('created_at', { ascending: true })
    : { data: [], error: null };
  if (orderError) throw orderError;

  const ordersBySession = new Map<string, SessionOrder[]>();
  for (const row of (orders ?? []) as SessionOrderRow[]) {
    const sessionId = row.session_id;
    const current = ordersBySession.get(sessionId) ?? [];
    current.push(mapOrder(row));
    ordersBySession.set(sessionId, current);
  }

  const names = new Map(departments.map((department) => [department.id, department.name]));
  return sessionRows.map((session) => ({
    id: session.id,
    departmentId: session.department_id,
    departmentName: names.get(session.department_id) ?? 'Department',
    startedAt: session.started_at,
    closedAt: session.closed_at,
    currency: ordersBySession.get(session.id)?.[0]?.currency ?? 'SEK',
    orders: ordersBySession.get(session.id) ?? [],
  }));
}

export async function closeDepartmentSession(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('close_department_session', { p_session_id: sessionId });
  if (error) throw error;
}

export function paymentLabelForReport(paymentStatus: string): string {
  return paymentStatus === 'pay_to_staff' ? 'Staff Payment' : 'Online Payment';
}

export function durationLabel(startedAt: string, closedAt: string | null): string {
  const end = closedAt ? Date.parse(closedAt) : Date.now();
  const minutes = Math.max(0, Math.floor((end - Date.parse(startedAt)) / 60000));
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours > 0 ? `${hours}h ${remaining}m` : `${remaining}m`;
}
