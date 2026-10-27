export const SUPPORTED_CURRENCIES = [
  { code: 'SEK', label: 'SEK — Swedish Krona' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'NOK', label: 'NOK — Norwegian Krone' },
  { code: 'DKK', label: 'DKK — Danish Krone' },
  { code: 'GBP', label: 'GBP — British Pound Sterling' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'CHF', label: 'CHF — Swiss Franc' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
] as const;

const CURRENCY_LOCALE: Record<string, string> = {
  SEK: 'sv-SE',
  NOK: 'nb-NO',
  DKK: 'da-DK',
  EUR: 'de-DE',
  USD: 'en-US',
  GBP: 'en-GB',
  INR: 'en-IN',
  CHF: 'de-CH',
  CAD: 'en-CA',
  AUD: 'en-AU',
};

const VALID_CODES: Set<string> = new Set(SUPPORTED_CURRENCIES.map((c) => c.code));

export function normalizeCurrency(code: string | null | undefined): string {
  if (code && VALID_CODES.has(code.toUpperCase())) return code.toUpperCase();
  return 'SEK';
}

export function isSupportedCurrency(code: string): boolean {
  return VALID_CODES.has(code.toUpperCase());
}

/**
 * Formats a minor-units integer as a currency string using the appropriate
 * locale for the given currency code.
 *
 * Uses Intl.NumberFormat with `style: 'currency'` so the correct symbol
 * and grouping are applied automatically (e.g. "40,00 kr", "€40.00", "$40.00").
 */
export function formatMinor(minor: number, currency = 'SEK'): string {
  const code = normalizeCurrency(currency);
  const locale = CURRENCY_LOCALE[code] ?? 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/**
 * Formats a raw numeric string (as entered by a host in a price field) for
 * display. Accepts "40", "29.50", "125" etc. Returns the formatted currency
 * string, or the raw input if it can't be parsed.
 */
export function formatPriceInput(raw: string, currency: string): string {
  const minor = parsePriceToMinor(raw);
  if (minor === null) return raw;
  return formatMinor(minor, currency);
}

/**
 * Parses a price string (free-text or numeric) into minor units (integer).
 * Strips non-numeric characters, handles European decimal commas.
 * Returns null if no number can be extracted.
 */
export function parsePriceToMinor(priceText: string): number | null {
  if (!priceText || typeof priceText !== 'string') return null;
  let s = priceText.trim().replace(/[^0-9.,]/g, '');
  if (!s) return null;
  const commaIdx = s.lastIndexOf(',');
  const dotIdx = s.lastIndexOf('.');
  if (commaIdx > dotIdx) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (dotIdx >= 0 && commaIdx >= 0 && commaIdx < dotIdx) {
    s = s.replace(/,/g, '');
  } else if (commaIdx >= 0 && dotIdx < 0) {
    const after = s.length - commaIdx - 1;
    if (after <= 2) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
  }
  const num = parseFloat(s);
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 100);
}

/**
 * Validates that a price input string contains a valid non-negative number.
 * Allows digits, one dot or comma as decimal separator, and optional leading
 * currency text that will be stripped. Returns true if a number can be parsed.
 */
export function isValidPriceInput(value: string): boolean {
  return parsePriceToMinor(value) !== null;
}
