export const MAX_REQUEST_WORDS = 50;
export const MAX_REQUEST_CHARS = 500;

/**
 * Parses a price text like "120 SEK", "150,00 kr", "$15.50", "95.00" into
 * integer minor units. Returns null if the string has no parseable number.
 */
export function parsePriceMinor(priceText: string): number | null {
  if (!priceText || typeof priceText !== 'string') return null;
  let s = priceText.trim();
  if (!s) return null;

  s = s.replace(/[^0-9.,]/g, '');
  if (!s) return null;

  const commaIdx = s.lastIndexOf(',');
  const dotIdx = s.lastIndexOf('.');
  if (commaIdx > dotIdx) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (dotIdx >= 0 && commaIdx >= 0 && commaIdx < dotIdx) {
    s = s.replace(/,/g, '');
  } else if (commaIdx >= 0 && dotIdx < 0) {
    const afterComma = s.length - commaIdx - 1;
    if (afterComma <= 2) {
      s = s.replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  }

  const num = parseFloat(s);
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 100);
}

export interface DishRow {
  id: string;
  name: string;
  price: string;
  available: boolean;
  restaurant_id: string;
  section: string;
  category: string;
  department_id: string | null;
  event_id: string | null;
}

export interface ServingOptionRow {
  id: string;
  dish_id: string;
  label: string;
  price: string;
  is_active: boolean;
}

export interface RemovableIngredientRow {
  id: string;
  dish_id: string;
  label: string;
  is_active: boolean;
}
