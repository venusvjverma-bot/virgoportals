import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  FileSearch,
  FlaskConical,
  ImageIcon,
  Info,
  Loader2,
  Pencil,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, Field } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { cn } from '@/lib/cn';
import type { ModelConfig, ModelState } from '@/types';

export type ModelKind = 'chat' | 'image' | 'extract';

export interface TestResult {
  reply?: string;
  imageUrl?: string;
  notice?: string;
}

interface ModelConfigViewProps {
  kind: ModelKind;
  config: ModelState;
  /** For the extraction model: the shared connection it runs on. */
  sharedConnection?: { provider: string; endpoint: string; hasApiKey: boolean };
  onSave: (config: ModelConfig) => Promise<void> | void;
  onTest: () => Promise<TestResult>;
}

const PROVIDERS = ['OpenAI', 'Anthropic', 'Google', 'Azure OpenAI', 'Custom'];

const TEMPERATURE_MIN = 0;
const TEMPERATURE_MAX = 2;
const MAX_TOKENS_MIN = 1;
const MAX_TOKENS_MAX = 100000;

const COPY = {
  chat: {
    title: 'Chat model',
    blurb: 'The language model that powers every host\u2019s visitor conversation.',
    note: 'Hosts never see this. Changing the model here updates what all hosts use.',
    saveLabel: 'Save chat model',
    icon: Sparkles,
  },
  image: {
    title: 'Image model',
    blurb: 'Generates the dish photos hosts attach to their menu items.',
    note: 'Used only for dish image generate.',
    saveLabel: 'Save image model',
    icon: ImageIcon,
  },
  extract: {
    title: 'Menu AI Extraction model',
    blurb: 'The model that reads uploaded menus and turns them into dishes.',
    note: 'Uses the same Provider, API key and Endpoint as the Chat model, so those are managed on the Chat model page.',
    saveLabel: 'Save extraction model',
    icon: FileSearch,
  },
} as const;

function draftFrom(config: ModelState): ModelConfig {
  return {
    provider: config.provider,
    apiKey: '',
    model: config.model,
    endpoint: config.endpoint,
    reasoningEnabled: config.reasoningEnabled,
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
  };
}

/** The reasoning switch is only sent to providers that document it. */
function reasoningIsSupported(provider: string, endpoint: string): boolean {
  const haystack = `${provider} ${endpoint}`.toLowerCase();
  return haystack.includes('venice');
}

export function ModelConfigView({ kind, config, sharedConnection, onSave, onTest }: ModelConfigViewProps) {
  const [draft, setDraft] = useState<ModelConfig>(() => draftFrom(config));
  const [temperatureText, setTemperatureText] = useState(String(config.temperature));
  const [maxTokensText, setMaxTokensText] = useState(String(config.maxOutputTokens));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'testing' | 'tested'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);

  const copy = COPY[kind];
  const Icon = copy.icon;
  const isChat = kind === 'chat';
  const isExtract = kind === 'extract';
  const connectionProvider = isExtract ? sharedConnection?.provider ?? '' : config.provider;
  const connectionEndpoint = isExtract ? sharedConnection?.endpoint ?? '' : config.endpoint;
  const reasoningSupported = reasoningIsSupported(connectionProvider, connectionEndpoint);

  useEffect(() => {
    setDraft(draftFrom(config));
    setTemperatureText(String(config.temperature));
    setMaxTokensText(String(config.maxOutputTokens));
  }, [config]);

  function update<K extends keyof ModelConfig>(key: K, value: ModelConfig[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setStatus('idle');
    setError(null);
    setResult(null);
  }

  function cancelEditing() {
    setDraft(draftFrom(config));
    setTemperatureText(String(config.temperature));
    setMaxTokensText(String(config.maxOutputTokens));
    setError(null);
    setEditing(false);
  }

  function validateNumbers(): { temperature: number; maxOutputTokens: number } | null {
    const temperature = Number(temperatureText.replace(',', '.').trim());
    if (!temperatureText.trim() || !Number.isFinite(temperature)) {
      setError('Temperature must be a number.');
      return null;
    }
    if (temperature < TEMPERATURE_MIN || temperature > TEMPERATURE_MAX) {
      setError(`Temperature must be between ${TEMPERATURE_MIN} and ${TEMPERATURE_MAX}.`);
      return null;
    }

    const maxOutputTokens = Number(maxTokensText.trim());
    if (!maxTokensText.trim() || !Number.isInteger(maxOutputTokens)) {
      setError('Maximum output tokens must be a whole number.');
      return null;
    }
    if (maxOutputTokens < MAX_TOKENS_MIN || maxOutputTokens > MAX_TOKENS_MAX) {
      setError(
        `Maximum output tokens must be between ${MAX_TOKENS_MIN} and ${MAX_TOKENS_MAX}.`
      );
      return null;
    }

    return { temperature, maxOutputTokens };
  }

  async function handleSave() {
    setError(null);

    const numbers = isChat ? validateNumbers() : null;
    if (isChat && !numbers) return;

    setSaving(true);
    try {
      await onSave({
        ...draft,
        temperature: numbers ? numbers.temperature : draft.temperature,
        maxOutputTokens: numbers ? numbers.maxOutputTokens : draft.maxOutputTokens,
      });
      setDraft((current) => ({ ...current, apiKey: '' }));
      setStatus('saved');
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save these settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setError(null);
    setResult(null);
    setStatus('testing');
    try {
      const next = await onTest();
      setResult(next);
      setStatus('tested');
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'The test failed.');
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Card className="animate-fade-in">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-olive-100 text-olive-700">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
              {copy.title}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{copy.blurb}</p>
          </div>
          {!editing ? (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)} className="shrink-0">
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          ) : null}
        </div>

        {editing ? (
          <>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {!isExtract ? (
                <Field label="Provider" htmlFor={`${kind}-provider`}>
                  <Select
                    id={`${kind}-provider`}
                    value={draft.provider}
                    onChange={(event) => update('provider', event.target.value)}
                  >
                    {PROVIDERS.map((provider) => (
                      <option key={provider} value={provider}>
                        {provider}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}

              <Field label="Model name" htmlFor={`${kind}-model`}>
                <Input
                  id={`${kind}-model`}
                  value={draft.model}
                  placeholder="gpt-4o-mini"
                  onChange={(event) => update('model', event.target.value)}
                />
              </Field>

              {!isExtract ? (
                <>
                  <Field label="API key" htmlFor={`${kind}-key`} className="sm:col-span-2">
                    <Input
                      id={`${kind}-key`}
                      type="password"
                      autoComplete="off"
                      value={draft.apiKey}
                      placeholder={
                        config.hasApiKey ? 'A key is saved — leave blank to keep it' : 'sk-...'
                      }
                      onChange={(event) => update('apiKey', event.target.value)}
                    />
                  </Field>

                  <Field label="Endpoint" htmlFor={`${kind}-endpoint`} className="sm:col-span-2">
                    <Input
                      id={`${kind}-endpoint`}
                      value={draft.endpoint}
                      placeholder="https://api.openai.com/v1/..."
                      onChange={(event) => update('endpoint', event.target.value)}
                    />
                  </Field>
                </>
              ) : null}

              {isChat || isExtract ? (
                <>
                  <Field
                    label="Reasoning"
                    htmlFor={`${kind}-reasoning`}
                    hint={isExtract ? 'Off is faster for menu reading.' : 'Off is faster and cheaper for menu questions.'}
                  >
                    <Select
                      id={`${kind}-reasoning`}
                      value={draft.reasoningEnabled ? 'enabled' : 'disabled'}
                      onChange={(event) =>
                        update('reasoningEnabled', event.target.value === 'enabled')
                      }
                    >
                      <option value="disabled">Disabled</option>
                      <option value="enabled">Enabled</option>
                    </Select>
                  </Field>

                  <Field
                    label="Temperature"
                    htmlFor={`${kind}-temperature`}
                    hint={`${TEMPERATURE_MIN} to ${TEMPERATURE_MAX}. Lower is more consistent.`}
                  >
                    <Input
                      id={`${kind}-temperature`}
                      inputMode="decimal"
                      value={temperatureText}
                      onChange={(event) => {
                        setTemperatureText(event.target.value);
                        setStatus('idle');
                        setError(null);
                        setResult(null);
                      }}
                    />
                  </Field>

                  <Field
                    label="Maximum output tokens"
                    htmlFor={`${kind}-max-tokens`}
                    className="sm:col-span-2"
                    hint={`Caps how long one answer can get. ${MAX_TOKENS_MIN} to ${MAX_TOKENS_MAX}.`}
                  >
                    <Input
                      id={`${kind}-max-tokens`}
                      inputMode="numeric"
                      value={maxTokensText}
                      onChange={(event) => {
                        setMaxTokensText(event.target.value);
                        setStatus('idle');
                        setError(null);
                        setResult(null);
                      }}
                    />
                  </Field>
                </>
              ) : null}
            </div>

            {(isChat || isExtract) && !reasoningSupported ? (
              <Notice tone="info" className="mt-5">
                The reasoning switch is only sent to Venice endpoints. Your provider is not Venice,
                so reasoning, temperature and the token cap are saved but not applied — we only send
                parameters a provider documents, so nothing here is reported as applied when it is not.
              </Notice>
            ) : null}
          </>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {!isExtract ? (
              <>
                <ReadOnlyField label="Provider" value={config.provider} />
                <ReadOnlyField label="Model name" value={config.model} />

                <ReadOnlyField
                  label="API key"
                  className="sm:col-span-2"
                  value={
                    <span className="flex items-center gap-2">
                      <Badge tone={config.hasApiKey ? 'success' : 'warning'}>
                        {config.hasApiKey ? 'A key is saved' : 'No key saved'}
                      </Badge>
                      <span className="text-xs text-ink-muted">
                        Stored on the server. It is never sent to this page.
                      </span>
                    </span>
                  }
                />

                <ReadOnlyField label="Endpoint" value={config.endpoint} className="sm:col-span-2" />
              </>
            ) : (
              <>
                <ReadOnlyField label="Model name" value={config.model} />
                <ReadOnlyField
                  label="Provider"
                  value={sharedConnection?.provider || 'Not set'}
                />
                <ReadOnlyField
                  label="API key"
                  className="sm:col-span-2"
                  value={
                    <span className="flex items-center gap-2">
                      <Badge tone={sharedConnection?.hasApiKey ? 'success' : 'warning'}>
                        {sharedConnection?.hasApiKey ? 'Shared with the Chat model' : 'No key saved on the Chat model'}
                      </Badge>
                      <span className="text-xs text-ink-muted">
                        Managed on the Chat model page.
                      </span>
                    </span>
                  }
                />
                <ReadOnlyField
                  label="Endpoint"
                  value={sharedConnection?.endpoint}
                  className="sm:col-span-2"
                />
              </>
            )}

            {isChat || isExtract ? (
              <>
                <ReadOnlyField
                  label="Reasoning"
                  value={
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={config.reasoningEnabled ? 'olive' : 'neutral'}>
                        {config.reasoningEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      {config.reasoningEnabled && !reasoningSupported ? (
                        <span className="text-xs text-ink-muted">
                          Not sent — your provider is not Venice.
                        </span>
                      ) : null}
                    </span>
                  }
                />
                {isChat ? (
                  <>
                    <ReadOnlyField label="Temperature" value={String(config.temperature)} />
                    <ReadOnlyField
                      label="Maximum output tokens"
                      value={String(config.maxOutputTokens)}
                      className="sm:col-span-2"
                    />
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        )}

        {error ? <Notice tone="error" className="mt-5">{error}</Notice> : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {editing ? (
            <>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : copy.saveLabel}
              </Button>
              <Button variant="secondary" onClick={cancelEditing} disabled={saving}>
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={handleTest} disabled={status === 'testing'}>
              {status === 'testing' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="h-4 w-4" />
              )}
              {status === 'testing' ? 'Testing…' : 'Test'}
            </Button>
          )}

          {status === 'saved' ? (
            <span className="inline-flex animate-pop items-center gap-1.5 text-sm font-medium text-success-600">
              <CheckCircle2 className="h-4 w-4" />
              Saved
            </span>
          ) : null}

          {editing ? (
            <span className="text-xs text-ink-muted">
              Save first to test the new settings.
            </span>
          ) : null}
        </div>

        {status === 'tested' && result ? (
          <div className="mt-5 animate-pop rounded-xl bg-cream-50 p-4 ring-1 ring-inset ring-cream-200">
            {kind !== 'image' ? (
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-olive-700 text-cream-100">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Live reply from your model
                  </p>
                  <p className="mt-1 text-sm text-ink">{result.reply}</p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Live image from your model
                </p>
                {result.imageUrl ? (
                  <img
                    src={result.imageUrl}
                    alt="Generated test image"
                    className="mt-2 w-full rounded-lg object-cover ring-1 ring-cream-300"
                  />
                ) : (
                  <p className="mt-2 text-sm text-ink-muted">No image was returned.</p>
                )}
              </div>
            )}
          </div>
        ) : null}

        {result?.notice ? (
          <Notice tone="info" className="mt-4">
            {result.notice}
          </Notice>
        ) : null}

        <p className="mt-6 flex items-start gap-2 rounded-xl bg-olive-50 px-4 py-3 text-sm text-olive-800 ring-1 ring-inset ring-olive-100">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{copy.note}</span>
        </p>
      </Card>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  const hasValue = typeof value === 'string' ? value.trim().length > 0 : true;
  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-sm font-medium text-ink-soft">{label}</p>
      <div
        className={cn(
          'break-words rounded-xl bg-cream-50 px-4 py-3 text-sm ring-1 ring-inset ring-cream-200',
          hasValue ? 'text-ink' : 'text-ink-faint'
        )}
      >
        {hasValue ? value : 'Not set'}
      </div>
    </div>
  );
}
