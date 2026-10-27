import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  MapPin,
  MessageSquareText,
  Pencil,
  Save,
  Store,
  UtensilsCrossed,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, Field } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { countWords } from '@/lib/links';
import { MAX_WELCOME_WORDS, COMMON_TIMEZONES } from '@/lib/constants';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';
import { cn } from '@/lib/cn';
import type { RestaurantPortal } from '@/types';

interface RestaurantViewProps {
  portal: RestaurantPortal;
  onSave: (patch: Pick<RestaurantPortal, 'name' | 'city' | 'welcome' | 'timezone' | 'currency'>) => Promise<void>;
}

export function RestaurantView({ portal, onSave }: RestaurantViewProps) {
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [name, setName] = useState(portal.name);
  const [city, setCity] = useState(portal.city);
  const [welcome, setWelcome] = useState(portal.welcome);
  const [timezone, setTimezone] = useState(portal.timezone);
  const [currency, setCurrency] = useState(portal.currency ?? 'SEK');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(portal.name);
    setCity(portal.city);
    setWelcome(portal.welcome);
    setTimezone(portal.timezone);
    setCurrency(portal.currency ?? 'SEK');
    setStatus('idle');
  }, [portal]);

  const words = countWords(welcome);
  const tooLong = words > MAX_WELCOME_WORDS;
  const dirty = name !== portal.name || city !== portal.city || welcome !== portal.welcome || timezone !== portal.timezone || currency !== (portal.currency ?? 'SEK');

  function handleEdit() {
    setError(null);
    setMode('edit');
  }

  function handleCancel() {
    setName(portal.name);
    setCity(portal.city);
    setWelcome(portal.welcome);
    setTimezone(portal.timezone);
    setCurrency(portal.currency ?? 'SEK');
    setError(null);
    setStatus('idle');
    setMode('read');
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError('Add your restaurant name before saving.');
      return;
    }
    if (tooLong) {
      setError(`Your welcome is ${words} words. Keep it to ${MAX_WELCOME_WORDS} words or fewer.`);
      return;
    }
    setStatus('saving');
    try {
      await onSave({ name: name.trim(), city: city.trim(), welcome: welcome.trim(), timezone, currency });
      setStatus('saved');
      setMode('read');
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Could not save your restaurant.');
    }
  }

  if (mode === 'read') {
    return (
      <div className="max-w-2xl space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: '#E4E8DF' }}
            >
              <Store className="h-5 w-5" style={{ color: '#58664F' }} />
            </div>
            <h2
              className="text-[26px] font-bold leading-tight"
              style={{ fontFamily: 'Georgia, serif', color: '#292A27' }}
            >
              Restaurant Information
            </h2>
          </div>
          <button
            type="button"
            onClick={handleEdit}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium transition-colors hover:bg-cream-100"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E4DED3',
              color: '#59664F',
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>

        <div
          className="overflow-hidden rounded-2xl"
          style={{ backgroundColor: '#FFFEFC', border: '1px solid #E8E1D7' }}
        >
          <div className="p-4">
            <InfoRow icon={<Store className="h-[18px] w-[18px]" />} label="Restaurant name" value={portal.name || '—'} />
            <Divider />
            <InfoRow icon={<MapPin className="h-[18px] w-[18px]" />} label="City" value={portal.city || '—'} />
            <Divider />
            <InfoRow
              icon={<MessageSquareText className="h-[18px] w-[18px]" />}
              label="Short welcome"
              value={portal.welcome || '—'}
              multiline
            />
            <Divider />
            <InfoRow icon={<Clock className="h-[18px] w-[18px]" />} label="Timezone" value={portal.timezone || '—'} />
            <Divider />
            <InfoRow icon={<Store className="h-[18px] w-[18px]" />} label="Currency" value={portal.currency || 'SEK'} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Card className="animate-fade-in">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Restaurant name" htmlFor="restaurant-name">
            <Input
              id="restaurant-name"
              value={name}
              placeholder="Olive & Thyme"
              onChange={(event) => {
                setName(event.target.value);
                setStatus('idle');
              }}
            />
          </Field>
          <Field label="City" htmlFor="restaurant-city">
            <Input
              id="restaurant-city"
              value={city}
              placeholder="Portland"
              onChange={(event) => {
                setCity(event.target.value);
                setStatus('idle');
              }}
            />
          </Field>
        </div>

        <Field
          label="Short welcome"
          htmlFor="restaurant-welcome"
          className="mt-5"
          hint="This is the first thing the visitor bot says. 30 to 60 words works best."
        >
          <Textarea
            id="restaurant-welcome"
            className="min-h-[140px]"
            value={welcome}
            placeholder="Welcome to our restaurant. Ask me about anything on our menu…"
            onChange={(event) => {
              setWelcome(event.target.value);
              setStatus('idle');
            }}
          />
        </Field>

        <Field
          label="Timezone"
          htmlFor="restaurant-timezone"
          className="mt-5"
          hint="Used for department operating hours and event schedules."
        >
          <Select
            id="restaurant-timezone"
            value={timezone}
            onChange={(event) => {
              setTimezone(event.target.value);
              setStatus('idle');
            }}
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </Select>
        </Field>

        <Field
          label="Currency"
          htmlFor="restaurant-currency"
          className="mt-5"
          hint="All menu prices use this currency. Changing it does not convert existing prices."
        >
          <Select
            id="restaurant-currency"
            value={currency}
            onChange={(event) => {
              setCurrency(event.target.value);
              setStatus('idle');
            }}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </Select>
        </Field>

        <div className="mt-2 flex items-center justify-between text-xs">
          <span className={cn('text-ink-muted', tooLong && 'font-medium text-error-600')}>
            {words} / {MAX_WELCOME_WORDS} words
          </span>
          {tooLong ? <span className="text-error-600">Too long — trim it down.</span> : null}
        </div>

        {error ? <Notice tone="error" className="mt-5">{error}</Notice> : null}

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={handleSave} disabled={!dirty || status === 'saving'}>
            <Save className="h-4 w-4" />
            {status === 'saving' ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
          {status === 'saved' ? (
            <span className="inline-flex animate-pop items-center gap-1.5 text-sm font-medium text-success-600">
              <CheckCircle2 className="h-4 w-4" />
              Saved
            </span>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function Divider() {
  return <div style={{ height: '1px', backgroundColor: '#EEE9E1', margin: '0' }} />;
}

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  multiline?: boolean;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center"
        style={{
          backgroundColor: '#F0F1EB',
          borderRadius: '10px',
          color: '#71806A',
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <p
          className="text-[11px] font-medium uppercase"
          style={{ letterSpacing: '0.5px', color: '#858278' }}
        >
          {label}
        </p>
        <p
          className="mt-0.5 text-[15px] font-medium break-words"
          style={{ color: '#292A27' }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
