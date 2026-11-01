import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import type { Department, EventItem, Order, OrderStatus, OrderItem, ResourceType, TipOption } from '@/types';

interface OrderRow {
  id: string;
  order_number: string;
  restaurant_id: string;
  department_id: string | null;
  event_id: string | null;
  resource_type: string;
  resource_name: string;
  restaurant_name: string;
  status: string;
  payment_status: string;
  subtotal_minor: number;
  tip_option: TipOption;
  tip_minor: number;
  total_minor: number;
  currency: string;
  item_count: number;
  mobile_number: string | null;
  created_at: string;
  status_updated_at: string;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  dish_id: string;
  name: string;
  price_minor: number;
  quantity: number;
  line_total_minor: number;
  serving_label: string | null;
  removed_ingredients: string | null;
  additional_request: string | null;
}

function mapOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    dishId: row.dish_id,
    name: row.name,
    priceMinor: row.price_minor,
    quantity: row.quantity,
    lineTotalMinor: row.line_total_minor,
    servingLabel: row.serving_label ?? null,
    removedIngredients: row.removed_ingredients ?? '',
    additionalRequest: row.additional_request ?? '',
  };
}

function mapOrder(row: OrderRow, items: OrderItem[]): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    restaurantId: row.restaurant_id,
    departmentId: row.department_id,
    eventId: row.event_id,
    resourceType: row.resource_type as ResourceType,
    resourceName: row.resource_name,
    restaurantName: row.restaurant_name,
    status: row.status as OrderStatus,
    paymentStatus: row.payment_status,
    subtotalMinor: row.subtotal_minor,
    tipOption: row.tip_option,
    tipMinor: row.tip_minor,
    totalMinor: row.total_minor,
    currency: row.currency,
    itemCount: row.item_count,
    mobileNumber: row.mobile_number,
    createdAt: row.created_at,
    statusUpdatedAt: row.status_updated_at,
    items,
  };
}

const ORDER_COLUMNS =
  'id, order_number, restaurant_id, department_id, event_id, resource_type, resource_name, restaurant_name, status, payment_status, subtotal_minor, tip_option, tip_minor, total_minor, currency, item_count, mobile_number, created_at, status_updated_at';

const ITEM_COLUMNS = 'id, order_id, dish_id, name, price_minor, quantity, line_total_minor, serving_label, removed_ingredients, additional_request';

export async function listOrders(restaurantId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const orders = (data ?? []) as OrderRow[];
  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const { data: itemsData, error: itemsError } = await supabase
    .from('order_items')
    .select(ITEM_COLUMNS)
    .in('order_id', orderIds);
  if (itemsError) throw itemsError;

  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const row of (itemsData ?? []) as OrderItemRow[]) {
    const list = itemsByOrder.get(row.order_id) ?? [];
    list.push(mapOrderItem(row));
    itemsByOrder.set(row.order_id, list);
  }

  return orders.map((o) => mapOrder(o, itemsByOrder.get(o.id) ?? []));
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: itemsData, error: itemsError } = await supabase
    .from('order_items')
    .select(ITEM_COLUMNS)
    .eq('order_id', orderId);
  if (itemsError) throw itemsError;

  return mapOrder(data as OrderRow, (itemsData ?? []).map((r) => mapOrderItem(r as OrderItemRow)));
}

interface CreateOrderResult {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotalMinor: number;
  tipOption: TipOption;
  tipMinor: number;
  totalMinor: number;
  currency: string;
  itemCount: number;
  createdAt: string;
  restaurantName: string;
  resourceName: string;
  resourceType: string;
  mobileNumber: string;
  items: { name: string; priceMinor: number; quantity: number; lineTotalMinor: number }[];
  idempotent: boolean;
}

export async function createOrder(params: {
  idempotencyKey: string;
  restaurantId: string;
  resourceId?: string;
  resourceType?: string;
  items: { dishId: string; quantity: number; servingOptionId?: string | null; removedIngredientIds?: string[]; additionalRequest?: string | null }[];
  mobileNumber: string;
  tip?: { option: TipOption; customMinor?: number };
}): Promise<CreateOrderResult> {
  return callFunction<CreateOrderResult>('visitor-orders', {
    action: 'create',
    idempotencyKey: params.idempotencyKey,
    restaurantId: params.restaurantId,
    resourceId: params.resourceId,
    resourceType: params.resourceType,
    items: params.items.map((i) => ({ dishId: i.dishId, quantity: i.quantity, servingOptionId: i.servingOptionId ?? null, removedIngredientIds: i.removedIngredientIds ?? [], additionalRequest: i.additionalRequest ?? null })),
    mobileNumber: params.mobileNumber,
    tip: params.tip,
  });
}

export async function updateOrderStatus(orderId: string, newStatus: OrderStatus): Promise<void> {
  await callFunction<{ success: boolean }>('visitor-orders', {
    action: 'status',
    orderId,
    newStatus,
  });
}

import { formatMinor } from '@/lib/currency';
export { formatMinor };

export const STATUS_FLOW: OrderStatus[] = ['new', 'accepted', 'preparing', 'ready', 'completed'];

export function nextStatus(current: OrderStatus): OrderStatus | null {
  const idx = STATUS_FLOW.indexOf(current);
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1];
}

export interface OrderGroup {
  key: string;
  title: string;
  orders: Order[];
}

const RESTAURANT_GROUP_KEY = 'restaurant';

export function groupOrdersByScope(orders: Order[], departments: Department[], events: EventItem[]): OrderGroup[] {
  const departmentNames = new Map(departments.map((d) => [d.id, d.name]));
  const eventNames = new Map(events.map((e) => [e.id, e.name]));
  const groups = new Map<string, OrderGroup>();

  const ensureGroup = (key: string, title: string): OrderGroup => {
    const existing = groups.get(key);
    if (existing) return existing;
    const group = { key, title, orders: [] };
    groups.set(key, group);
    return group;
  };

  const newestFirst = [...orders].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  for (const order of newestFirst) {
    if (order.eventId) {
      const title = eventNames.get(order.eventId) ?? 'Unknown event';
      ensureGroup(`event:${order.eventId}`, title).orders.push(order);
    } else if (order.departmentId) {
      const title = departmentNames.get(order.departmentId) ?? 'Unknown department';
      ensureGroup(`department:${order.departmentId}`, title).orders.push(order);
    } else {
      ensureGroup(RESTAURANT_GROUP_KEY, 'Restaurant').orders.push(order);
    }
  }

  const orderedKeys = [
    RESTAURANT_GROUP_KEY,
    ...departments.map((d) => `department:${d.id}`),
    ...events.map((e) => `event:${e.id}`),
  ];
  const known = orderedKeys.map((key) => groups.get(key)).filter((g): g is OrderGroup => Boolean(g));
  const unknown = [...groups.values()].filter((g) => !orderedKeys.includes(g.key));
  return [...known, ...unknown].filter((g) => g.orders.length > 0);
}

export function statusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    new: 'New',
    accepted: 'Accepted',
    preparing: 'Preparing',
    ready: 'Ready',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return labels[status] ?? status;
}
