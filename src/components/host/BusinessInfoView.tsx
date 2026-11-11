import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, MapPin, Pencil, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, Field } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { Divider, InfoRow } from '@/components/host/InfoRow';
import type { RestaurantPortal } from '@/types';

interface BusinessInfoViewProps {
  portal: RestaurantPortal;
  onSave: (patch: Pick<RestaurantPortal, 'businessName' | 'businessAddress'>) => Promise<void>;
}

/**
 * Optional invoicing details, kept separate from Restaurant Information. Both
 * fields may stay empty, and either one can be saved on its own.
 */
export function BusinessInfoView({ portal, onSave }: BusinessInfoViewProps) {
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [businessName, setBusinessName] = useState(portal.businessName ?? '');
  const [businessAddress, setBusinessAddress] = useState(portal.businessAddress ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBusinessName(portal.businessName ?? '');
    setBusinessAddress(portal.businessAddress ?? '');
    setStatus('idle');
  }, [portal]);

  const dirty =
    businessName.trim() !== (portal.businessName ?? '') ||
    businessAddress.trim() !== (portal.businessAddress ?? '');

  function handleEdit() {
    setError(null);
    setMode('edit');
  }

  function handleCancel() {
    setBusinessName(portal.businessName ?? '');
    setBusinessAddress(portal.businessAddress ?? '');
    setError(null);
    setStatus('idle');
    setMode('read');
  }

  async function handleSave() {
    setError(null);
    setStatus('saving');
    try {
      // Empty is a valid value: it simply clears the field.
      await onSave({ businessName: businessName.trim(), businessAddress: businessAddress.trim() });
      setStatus('saved');
      setMode('read');
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Could not save your business information.');
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
              <Building2 className="h-5 w-5" style={{ color: '#58664F' }} />
            </div>
            <h2
              className="text-[26px] font-bold leading-tight"
              style={{ fontFamily: 'Georgia, serif', color: '#292A27' }}
            >
              Business Information
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
            <InfoRow
              icon={<Building2 className="h-[18px] w-[18px]" />}
              label="Business name"
              value={portal.businessName || '—'}
            />
            <Divider />
            <InfoRow
              icon={<MapPin className="h-[18px] w-[18px]" />}
              label="Business address"
              value={portal.businessAddress || '—'}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Card className="animate-fade-in">
        <Field
          label="Business name"
          htmlFor="business-name"
          hint="Optional. The registered or trading name of your business."
        >
          <Input
            id="business-name"
            value={businessName}
            placeholder="Olive & Thyme AB"
            onChange={(event) => {
              setBusinessName(event.target.value);
              setStatus('idle');
            }}
          />
        </Field>

        <Field
          label="Business address"
          htmlFor="business-address"
          className="mt-5"
          hint="Optional. Used on invoices later."
        >
          <Input
            id="business-address"
            value={businessAddress}
            placeholder="Storgatan 12, 114 55 Stockholm"
            onChange={(event) => {
              setBusinessAddress(event.target.value);
              setStatus('idle');
            }}
          />
        </Field>

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
