import { useState } from 'react';
import { ArrowLeft, Check, Loader2, AlertCircle, Search, ChevronDown } from 'lucide-react';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { cn } from '@/lib/cn';
import { basketLineKey } from '@/lib/basketLine';
import { createOrder } from '@/lib/orders';
import { ComboSelectionLines } from '@/components/visitor/ComboSelectionLines';
import { formatMinor, parsePriceToMinor, formatPriceInput } from '@/lib/currency';
import { computeTipMinor } from '@/lib/tip';
import { Notice } from '@/components/ui/Notice';
import { TipSelector } from '@/components/visitor/TipSelector';
import { ConciergeBell, BedDouble } from 'lucide-react';
import { PaymentMethodSelector } from '@/components/visitor/PaymentMethodSelector';
import { TermsPage } from '@/components/visitor/TermsPage';
import type { BasketItem, PaymentMethod, ResourceType, TipOption } from '@/types';

interface CheckoutViewProps {
  items: BasketItem[];
  restaurantName: string;
  restaurantId: string;
  resourceName: string;
  resourceId?: string;
  resourceType?: ResourceType;
  currency: string;
  tableServiceEnabled?: boolean;
  tableServiceCharge?: number;
  roomServiceEnabled?: boolean;
  roomServiceCharge?: number;
  onBack: () => void;
  onConfirmed: (result: ConfirmedOrder) => void;
}

export interface ConfirmedOrder {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  serviceType?: 'table' | 'room' | null;
  serviceLocation?: string | null;
  serviceChargeMinor?: number;
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
  items: { name: string; priceMinor: number; quantity: number; lineTotalMinor: number; servingLabel: string | null; variantName: string | null; removedIngredients: string; addOns: { name: string; priceMinor: number }[] }[];
}

interface Country {
  name: string;
  code: string;
  callingCode: string;
  iso: string;
}

const COUNTRIES: Country[] = [
  { name: 'Sweden', code: 'SE', callingCode: '+46', iso: 'SE' },
  { name: 'India', code: 'IN', callingCode: '+91', iso: 'IN' },
  { name: 'United Kingdom', code: 'GB', callingCode: '+44', iso: 'GB' },
  { name: 'United States', code: 'US', callingCode: '+1', iso: 'US' },
  { name: 'Germany', code: 'DE', callingCode: '+49', iso: 'DE' },
  { name: 'France', code: 'FR', callingCode: '+33', iso: 'FR' },
  { name: 'Spain', code: 'ES', callingCode: '+34', iso: 'ES' },
  { name: 'Italy', code: 'IT', callingCode: '+39', iso: 'IT' },
  { name: 'Portugal', code: 'PT', callingCode: '+351', iso: 'PT' },
  { name: 'Netherlands', code: 'NL', callingCode: '+31', iso: 'NL' },
  { name: 'Belgium', code: 'BE', callingCode: '+32', iso: 'BE' },
  { name: 'Switzerland', code: 'CH', callingCode: '+41', iso: 'CH' },
  { name: 'Austria', code: 'AT', callingCode: '+43', iso: 'AT' },
  { name: 'Denmark', code: 'DK', callingCode: '+45', iso: 'DK' },
  { name: 'Norway', code: 'NO', callingCode: '+47', iso: 'NO' },
  { name: 'Finland', code: 'FI', callingCode: '+358', iso: 'FI' },
  { name: 'Poland', code: 'PL', callingCode: '+48', iso: 'PL' },
  { name: 'Ireland', code: 'IE', callingCode: '+353', iso: 'IE' },
  { name: 'Greece', code: 'GR', callingCode: '+30', iso: 'GR' },
  { name: 'Czech Republic', code: 'CZ', callingCode: '+420', iso: 'CZ' },
  { name: 'Hungary', code: 'HU', callingCode: '+36', iso: 'HU' },
  { name: 'Romania', code: 'RO', callingCode: '+40', iso: 'RO' },
  { name: 'Turkey', code: 'TR', callingCode: '+90', iso: 'TR' },
  { name: 'Russia', code: 'RU', callingCode: '+7', iso: 'RU' },
  { name: 'Ukraine', code: 'UA', callingCode: '+380', iso: 'UA' },
  { name: 'China', code: 'CN', callingCode: '+86', iso: 'CN' },
  { name: 'Japan', code: 'JP', callingCode: '+81', iso: 'JP' },
  { name: 'South Korea', code: 'KR', callingCode: '+82', iso: 'KR' },
  { name: 'Pakistan', code: 'PK', callingCode: '+92', iso: 'PK' },
  { name: 'Bangladesh', code: 'BD', callingCode: '+880', iso: 'BD' },
  { name: 'Sri Lanka', code: 'LK', callingCode: '+94', iso: 'LK' },
  { name: 'Nepal', code: 'NP', callingCode: '+977', iso: 'NP' },
  { name: 'United Arab Emirates', code: 'AE', callingCode: '+971', iso: 'AE' },
  { name: 'Saudi Arabia', code: 'SA', callingCode: '+966', iso: 'SA' },
  { name: 'Qatar', code: 'QA', callingCode: '+974', iso: 'QA' },
  { name: 'Kuwait', code: 'KW', callingCode: '+965', iso: 'KW' },
  { name: 'Bahrain', code: 'BH', callingCode: '+973', iso: 'BH' },
  { name: 'Oman', code: 'OM', callingCode: '+968', iso: 'OM' },
  { name: 'Israel', code: 'IL', callingCode: '+972', iso: 'IL' },
  { name: 'Egypt', code: 'EG', callingCode: '+20', iso: 'EG' },
  { name: 'South Africa', code: 'ZA', callingCode: '+27', iso: 'ZA' },
  { name: 'Nigeria', code: 'NG', callingCode: '+234', iso: 'NG' },
  { name: 'Kenya', code: 'KE', callingCode: '+254', iso: 'KE' },
  { name: 'Morocco', code: 'MA', callingCode: '+212', iso: 'MA' },
  { name: 'Australia', code: 'AU', callingCode: '+61', iso: 'AU' },
  { name: 'New Zealand', code: 'NZ', callingCode: '+64', iso: 'NZ' },
  { name: 'Singapore', code: 'SG', callingCode: '+65', iso: 'SG' },
  { name: 'Malaysia', code: 'MY', callingCode: '+60', iso: 'MY' },
  { name: 'Thailand', code: 'TH', callingCode: '+66', iso: 'TH' },
  { name: 'Indonesia', code: 'ID', callingCode: '+62', iso: 'ID' },
  { name: 'Philippines', code: 'PH', callingCode: '+63', iso: 'PH' },
  { name: 'Vietnam', code: 'VN', callingCode: '+84', iso: 'VN' },
  { name: 'Hong Kong', code: 'HK', callingCode: '+852', iso: 'HK' },
  { name: 'Brazil', code: 'BR', callingCode: '+55', iso: 'BR' },
  { name: 'Mexico', code: 'MX', callingCode: '+52', iso: 'MX' },
  { name: 'Argentina', code: 'AR', callingCode: '+54', iso: 'AR' },
  { name: 'Chile', code: 'CL', callingCode: '+56', iso: 'CL' },
  { name: 'Colombia', code: 'CO', callingCode: '+57', iso: 'CO' },
  { name: 'Canada', code: 'CA', callingCode: '+1', iso: 'CA' },
];

export function CheckoutView({
  items,
  restaurantName,
  restaurantId,
  resourceName,
  resourceId,
  resourceType,
  currency,
  tableServiceEnabled = false,
  tableServiceCharge = 0,
  roomServiceEnabled = false,
  roomServiceCharge = 0,
  onBack,
  onConfirmed,
}: CheckoutViewProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [nationalNumber, setNationalNumber] = useState('');
  const [tipOption, setTipOption] = useState<TipOption>('none');
  const [customTipInput, setCustomTipInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pay_to_staff');
  const anyServiceEnabled = tableServiceEnabled || roomServiceEnabled;
  const bothServicesEnabled = tableServiceEnabled && roomServiceEnabled;
  const [serviceType, setServiceType] = useState<'table' | 'room' | null>(
    anyServiceEnabled ? (roomServiceEnabled && !tableServiceEnabled ? 'room' : 'table') : null
  );
  const [serviceLocation, setServiceLocation] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [idempotencyKey] = useState(() => {
    const existing = sessionStorage.getItem('vp_checkout_key');
    if (existing) return existing;
    const key = crypto.randomUUID();
    sessionStorage.setItem('vp_checkout_key', key);
    return key;
  });

  const subtotalMinor = items.reduce((sum, item) => {
    return sum + (parsePriceToMinor(item.price) ?? 0) * item.quantity;
  }, 0);

  const customTipMinor = parsePriceToMinor(customTipInput);
  const customTipError =
    tipOption === 'custom' && customTipInput.trim() !== '' && customTipMinor === null
      ? 'Please enter a valid amount.'
      : null;
  const effectiveTipOption: TipOption =
    tipOption === 'custom' && customTipMinor === null ? 'none' : tipOption;
  const tipMinor = computeTipMinor(effectiveTipOption, customTipMinor ?? 0, subtotalMinor);
  const serviceChargeMinor =
    serviceType === 'table' ? tableServiceCharge : serviceType === 'room' ? roomServiceCharge : 0;
  const grandTotalMinor = subtotalMinor + tipMinor + serviceChargeMinor;
  const trimmedLocation = serviceLocation.trim();
  const serviceLocationMissing = anyServiceEnabled && trimmedLocation === '';
  const serviceLocationInvalid = anyServiceEnabled && trimmedLocation.length > 20;

  function normalizePhone(): string | null {
    if (!nationalNumber.trim() || !selectedCountry) return null;
    const fullNumber = `${selectedCountry.callingCode}${nationalNumber.trim()}`;
    const parsed = parsePhoneNumberFromString(fullNumber, selectedCountry.code as never);
    if (!parsed || !parsed.isValid()) return null;
    return parsed.format('E.164');
  }

  function validatePhone(): string | null {
    if (!selectedCountry) return 'Please select a country code.';
    if (!nationalNumber.trim()) return 'Please enter your mobile number.';
    const normalized = normalizePhone();
    if (!normalized) return 'Please enter a valid mobile number for the selected country.';
    return null;
  }

  const phoneValid = validatePhone() === null;

  const filteredCountries = COUNTRIES.filter((c) => {
    const q = countrySearch.trim().toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.callingCode.includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  });

  async function handleConfirm() {
    if (submitting || items.length === 0) return;

    const phoneErr = validatePhone();
    if (phoneErr) {
      setPhoneError(phoneErr);
      return;
    }
    setPhoneError(null);

    const normalizedMobile = normalizePhone();
    if (!normalizedMobile) {
      setPhoneError('Could not validate the mobile number. Please check and try again.');
      return;
    }

    if (serviceLocationMissing || serviceLocationInvalid) {
      setError(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await createOrder({
        idempotencyKey,
        restaurantId,
        resourceId,
        resourceType: resourceType ?? 'restaurant',
        items: items.map((i) =>
          i.comboId
            ? {
                comboId: i.comboId,
                quantity: i.quantity,
                selections: (i.comboSelections ?? []).map((s) => ({ groupId: s.groupId, dishId: s.dishId, servingOptionId: s.servingOptionId })),
              }
            : { dishId: i.dishId, quantity: i.quantity, servingOptionId: i.servingOptionId ?? null, variantId: i.variantId ?? null, addOnIds: (i.addOns ?? []).map((a) => a.id), removedIngredientIds: i.removedIngredientIds ?? [], additionalRequest: i.additionalRequest ?? '' },
        ),
        mobileNumber: normalizedMobile,
        paymentMethod,
        service:
          serviceType && trimmedLocation && !serviceLocationInvalid
            ? { type: serviceType, location: trimmedLocation }
            : undefined,
        tip: {
          option: effectiveTipOption,
          customMinor: effectiveTipOption === 'custom' ? customTipMinor ?? undefined : undefined,
        },
      });
      sessionStorage.removeItem('vp_checkout_key');
      onConfirmed(result as ConfirmedOrder);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cream-100 animate-fade-in">
      <header className="flex items-center gap-3 border-b border-cream-200 bg-cream-50 px-5 py-4">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          aria-label="Back to basket"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink-soft shadow-soft ring-1 ring-cream-200 transition-all duration-200 hover:text-ink disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Checkout</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-soft">
        <div className="mx-auto max-w-md px-5 py-6">
          {paymentMethod === 'pay_online' ? (
            <div className="mb-5 rounded-2xl bg-warning-50 px-4 py-3 ring-1 ring-warning-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-warning-700" />
                <p className="text-sm font-semibold text-warning-800">
                  TEST CHECKOUT — NO PAYMENT WILL BE TAKEN
                </p>
              </div>
              <p className="mt-1 text-xs text-warning-700">
                This is a prototype order. No real payment, card details, or SMS verification is required.
              </p>
            </div>
          ) : null}

          {/* Restaurant info */}
          <div className="mb-5 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Restaurant</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{restaurantName}</p>
            {resourceName && resourceName !== restaurantName ? (
              <>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                  {resourceType === 'event' ? 'Event' : 'Department'}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-ink">{resourceName}</p>
              </>
            ) : null}
          </div>

          {/* Tip */}
          <TipSelector
            currency={currency}
            subtotalMinor={subtotalMinor}
            selectedOption={tipOption}
            customInput={customTipInput}
            customError={customTipError}
            tipMinor={tipMinor}
            totalMinor={grandTotalMinor}
            onSelectOption={setTipOption}
            onCustomInputChange={setCustomTipInput}
          />

          {/* Serving area */}
          {anyServiceEnabled ? (
            <div className="mb-5 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200">
              <h3 className="text-sm font-semibold text-ink">Serving area</h3>
              <p className="mb-3 mt-0.5 text-xs text-ink-muted">
                {bothServicesEnabled
                  ? 'Choose how your order should be served.'
                  : serviceType === 'room'
                    ? 'Your order will be delivered to your room.'
                    : 'Your order will be served at your table.'}
              </p>
              {bothServicesEnabled ? (
                <div className="grid grid-cols-2 gap-3">
                  {([
                    {
                      value: 'table' as const,
                      label: 'Table Service',
                      hint: 'Served at your table',
                      icon: <ConciergeBell className="h-4 w-4" />,
                    },
                    {
                      value: 'room' as const,
                      label: 'Room Service',
                      hint: 'Delivered to your room',
                      icon: <BedDouble className="h-4 w-4" />,
                    },
                  ]).map((opt) => {
                    const selected = serviceType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setServiceType(opt.value)}
                        aria-pressed={selected}
                        className={cn(
                          'flex flex-col items-start gap-1 rounded-xl p-3 text-left ring-1 transition-all duration-200',
                          selected
                            ? 'bg-olive-50 ring-2 ring-olive-600'
                            : 'bg-cream-50 ring-cream-200 hover:ring-olive-300'
                        )}
                      >
                        <span className="flex w-full items-center justify-between">
                          <span className={cn('shrink-0', selected ? 'text-olive-700' : 'text-ink-muted')}>
                            {opt.icon}
                          </span>
                          <span
                            className={cn(
                              'h-4 w-4 rounded-full border-2 transition-colors',
                              selected ? 'border-olive-600 bg-olive-600' : 'border-cream-300 bg-white'
                            )}
                          >
                            {selected ? <Check className="h-3 w-3 text-white" /> : null}
                          </span>
                        </span>
                        <span className={cn('text-sm font-semibold', selected ? 'text-olive-800' : 'text-ink')}>
                          {opt.label}
                        </span>
                        <span className="text-xs text-ink-muted">{opt.hint}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {serviceType ? (
                <div className="mt-3">
                  <label
                    htmlFor="service-location"
                    className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted"
                  >
                    {serviceType === 'room' ? 'Room number' : 'Table number'}
                  </label>
                  <input
                    id="service-location"
                    type="text"
                    value={serviceLocation}
                    maxLength={20}
                    onChange={(e) => setServiceLocation(e.target.value)}
                    placeholder={serviceType === 'room' ? 'e.g. 512B' : 'e.g. A12'}
                    className="w-full rounded-xl border-0 bg-cream-50 px-4 py-3 text-sm text-ink shadow-soft ring-1 ring-inset ring-cream-300 transition-all duration-200 placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-olive-500"
                  />
                  {serviceLocationInvalid ? (
                    <p className="mt-1.5 text-xs font-medium text-error-600">
                      Please use at most 20 characters.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Items */}
          <div className="mb-5 overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-cream-200">
            <div className="border-b border-cream-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-ink">Order summary</h3>
            </div>
            <ul className="divide-y divide-cream-200">
              {items.map((item) => (
                <li key={`${item.dishId}-${item.servingOptionId ?? ""}-${basketLineKey(item)}`} className="flex items-center gap-3 px-4 py-3">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-cream-200"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                    <p className="text-xs text-ink-muted">
                      {item.quantity} × {formatPriceInput(item.price, currency)}{item.servingLabel ? ` · ${item.servingLabel}` : ''}{item.variantName ? ` · ${item.variantName}` : ''}
                    </p>
                    {item.comboSelections && item.comboSelections.length > 0 ? (
                      <ComboSelectionLines selections={item.comboSelections} />
                    ) : null}
                    {item.removedIngredientLabels && item.removedIngredientLabels.length > 0 ? (
                      <p className="mt-0.5 text-xs font-medium text-ink-faint">
                        {item.removedIngredientLabels.map((l) => `No ${l}`).join(' · ')}
                      </p>
                    ) : null}
                    {item.addOns && item.addOns.length > 0 ? (
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {item.addOns.map((a) => `${a.name} +${formatPriceInput(a.price, currency)}`).join(' · ')}
                      </p>
                    ) : null}
                    {item.additionalRequest ? (
                      <p className="mt-0.5 text-xs text-ink-muted">
                        <span className="font-medium text-ink">Request:</span> {item.additionalRequest}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-olive-700">
                    {formatMinor((parsePriceToMinor(item.price) ?? 0) * item.quantity, currency)}
                  </span>
                </li>
              ))}
            </ul>
            {tipMinor > 0 ? (
              <div className="flex items-center justify-between border-t border-cream-200 px-4 py-3">
                <span className="text-sm text-ink-soft">Tip</span>
                <span className="text-sm font-medium text-ink">{formatMinor(tipMinor, currency)}</span>
              </div>
            ) : null}
            {serviceType && serviceChargeMinor > 0 ? (
              <div className="flex items-center justify-between border-t border-cream-200 px-4 py-3">
                <span className="text-sm text-ink-soft">
                  {serviceType === 'room' ? 'Room service charge' : 'Table service charge'}
                </span>
                <span className="text-sm font-medium text-ink">
                  {formatMinor(serviceChargeMinor, currency)}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t border-cream-200 px-4 py-3">
              <span className="text-sm font-semibold text-ink">Total</span>
              <span className="font-display text-lg font-semibold text-ink">
                {formatMinor(grandTotalMinor, currency)}
              </span>
            </div>
          </div>

          {/* Mobile number */}
          <div className="mb-5 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200">
            <h3 className="mb-1 text-sm font-semibold text-ink">Mobile number</h3>
            <p className="mb-3 text-xs text-ink-muted">
              Required so the restaurant can contact you about your order.
            </p>
            <div className="flex gap-2">
              {/* Country code selector */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowCountryDropdown((v) => !v);
                    setCountrySearch('');
                  }}
                  className="flex h-[46px] items-center gap-1.5 rounded-xl border-0 bg-cream-50 px-3 text-sm font-medium text-ink shadow-soft ring-1 ring-inset ring-cream-300 transition-all duration-200 hover:ring-olive-300 focus:outline-none focus:ring-2 focus:ring-olive-500"
                  aria-label="Select country calling code"
                >
                  <span className="text-base leading-none">{selectedCountry.callingCode}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
                </button>
                {showCountryDropdown ? (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowCountryDropdown(false)}
                    />
                    <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl bg-white shadow-lift ring-1 ring-cream-200">
                      <div className="border-b border-cream-200 p-2">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
                          <input
                            type="text"
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            placeholder="Search country…"
                            autoFocus
                            className="w-full rounded-lg border-0 bg-cream-50 py-2 pl-8 pr-3 text-sm text-ink ring-1 ring-inset ring-cream-300 placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-olive-500"
                          />
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto overscroll-contain scrollbar-soft">
                        {filteredCountries.length === 0 ? (
                          <p className="px-3 py-4 text-center text-xs text-ink-muted">
                            No countries match your search.
                          </p>
                        ) : (
                          filteredCountries.map((c) => (
                            <button
                              key={`${c.code}-${c.callingCode}`}
                              type="button"
                              onClick={() => {
                                setSelectedCountry(c);
                                setShowCountryDropdown(false);
                                setPhoneError(null);
                              }}
                              className={cn(
                                'flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors',
                                'hover:bg-olive-50',
                                selectedCountry.code === c.code &&
                                  selectedCountry.callingCode === c.callingCode
                                  ? 'bg-olive-50 font-medium text-olive-800'
                                  : 'text-ink'
                              )}
                            >
                              <span className="truncate">{c.name}</span>
                              <span className="shrink-0 text-ink-muted">{c.callingCode}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              {/* National number input */}
              <input
                type="tel"
                value={nationalNumber}
                onChange={(e) => {
                  setNationalNumber(e.target.value);
                  setPhoneError(null);
                }}
                placeholder="Enter your number"
                className="flex-1 rounded-xl border-0 bg-cream-50 px-4 py-3 text-sm text-ink shadow-soft ring-1 ring-inset ring-cream-300 transition-all duration-200 placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-olive-500"
                autoComplete="tel-national"
              />
            </div>
            {phoneError ? (
              <p className="mt-2 text-xs font-medium text-error-600">{phoneError}</p>
            ) : null}
            {phoneValid && nationalNumber.trim() ? (
              <p className="mt-2 text-xs font-medium text-olive-600">
                {normalizePhone()}
              </p>
            ) : null}
          </div>

          <PaymentMethodSelector selectedMethod={paymentMethod} onSelectMethod={setPaymentMethod} />

          <p className="mb-5 text-sm leading-relaxed text-ink-muted">
            Please review our{' '}
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="font-semibold text-blue-600 underline underline-offset-2 transition-colors duration-200 hover:text-blue-700 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-500"
            >
              Terms & Conditions
            </button>{' '}
            before placing your order. By placing your order, you agree to these terms.
          </p>

          {error ? (
            <Notice tone="error" className="mb-4">
              {error}
            </Notice>
          ) : null}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={
              submitting ||
              items.length === 0 ||
              !phoneValid ||
              customTipError !== null ||
              serviceLocationMissing ||
              serviceLocationInvalid
            }
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-semibold text-white shadow-soft transition-all duration-200',
              'bg-olive-700 hover:bg-olive-800 hover:shadow-lift active:scale-[0.99]',
              'disabled:cursor-not-allowed disabled:opacity-60'
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating order…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {paymentMethod === 'pay_online' ? 'Confirm test order' : 'Place order'}
              </>
            )}
          </button>

          <p className="mt-3 text-center text-xs text-ink-faint">
            {paymentMethod === 'pay_online'
              ? 'By confirming, a test order is created and sent to the restaurant. No payment is processed.'
              : 'By placing your order, it is sent to the restaurant. You pay the restaurant staff directly.'}
          </p>
        </div>
      </div>

      {showTerms ? <TermsPage onClose={() => setShowTerms(false)} /> : null}
    </div>
  );
}


