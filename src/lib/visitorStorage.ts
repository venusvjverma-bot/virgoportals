import type { BasketItem, ConfirmedOrderRef, Dish } from '@/types';

type StoredDish = Partial<Dish> & { dishId?: string };

interface StoredMessage {
  id: string;
  role: 'visitor' | 'bot';
  text: string;
  dishes: StoredDish[];
}

function textOr(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function restoreDish(raw: StoredDish): Dish {
  return {
    id: textOr(raw.id, textOr(raw.dishId)),
    restaurantId: textOr(raw.restaurantId),
    name: textOr(raw.name),
    description: textOr(raw.description),
    ingredients: textOr(raw.ingredients),
    allergy: textOr(raw.allergy),
    price: textOr(raw.price),
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : null,
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : 0,
    category: textOr(raw.category),
    section: textOr(raw.section),
    serving: textOr(raw.serving),
    abv: textOr(raw.abv),
    available: typeof raw.available === 'boolean' ? raw.available : true,
    departmentId: typeof raw.departmentId === 'string' ? raw.departmentId : null,
    eventId: typeof raw.eventId === 'string' ? raw.eventId : null,
    servingOptions: Array.isArray(raw.servingOptions) ? raw.servingOptions : [],
    removableIngredients: Array.isArray(raw.removableIngredients) ? raw.removableIngredients : [],
  };
}

function scopeKey(restaurantId: string, resourceId?: string, resourceType?: string): string {
  const parts = ['vp', restaurantId];
  if (resourceId && resourceType) {
    parts.push(resourceType, resourceId);
  }
  return parts.join(':');
}

function chatKey(scope: string): string {
  return `${scope}:chat`;
}

function basketKey(scope: string): string {
  return `${scope}:basket`;
}

function orderKey(scope: string): string {
  return `${scope}:order`;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadChatHistory(scope: string): { id: string; role: 'visitor' | 'bot'; text: string; dishes: Dish[] }[] | null {
  const data = safeParse<StoredMessage[]>(localStorage.getItem(chatKey(scope)));
  if (!data || !Array.isArray(data)) return null;
  return data.map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    dishes: (Array.isArray(m.dishes) ? m.dishes : []).map(restoreDish),
  }));
}

export function saveChatHistory(scope: string, messages: { id: string; role: 'visitor' | 'bot'; text: string; dishes: Dish[] }[]): void {
  const stored: StoredMessage[] = messages.map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    dishes: m.dishes,
  }));
  try {
    localStorage.setItem(chatKey(scope), JSON.stringify(stored));
  } catch {
    // Ignore quota errors
  }
}

export function clearChatHistory(scope: string): void {
  localStorage.removeItem(chatKey(scope));
}

export function loadBasket(scope: string): BasketItem[] | null {
  const data = safeParse<BasketItem[]>(localStorage.getItem(basketKey(scope)));
  if (!data || !Array.isArray(data)) return null;
  return data
    .filter((item) => item.dishId && item.quantity >= 1)
    .map((item) => ({
      ...item,
      removedIngredientIds: item.removedIngredientIds ?? [],
      removedIngredientLabels: item.removedIngredientLabels ?? [],
    }));
}

export function saveBasket(scope: string, items: BasketItem[]): void {
  try {
    localStorage.setItem(basketKey(scope), JSON.stringify(items));
  } catch {
    // Ignore quota errors
  }
}

export function loadConfirmedOrder(scope: string): ConfirmedOrderRef | null {
  return safeParse<ConfirmedOrderRef>(localStorage.getItem(orderKey(scope)));
}

export function saveConfirmedOrder(scope: string, ref: ConfirmedOrderRef): void {
  try {
    localStorage.setItem(orderKey(scope), JSON.stringify(ref));
  } catch {
    // Ignore quota errors
  }
}

export { scopeKey };
