import { useState } from 'react';
import { CheckCircle2, Info, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';

interface BotTextViewProps {
  value: string;
  onSave: (text: string) => Promise<void> | void;
}

export function BotTextView({ value, onSave }: BotTextViewProps) {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = draft !== value;

  async function handleSave() {
    setError(null);
    try {
      await onSave(draft);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the default bot text.');
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <Card className="animate-fade-in">
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
          Default bot text
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          The starting prompt every new restaurant portal opens with.
        </p>

        <Textarea
          className="mt-5 min-h-[240px] font-mono text-[13px]"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setSaved(false);
            setError(null);
          }}
          spellCheck={false}
        />

        {error ? <Notice tone="error" className="mt-4">{error}</Notice> : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={handleSave} disabled={!dirty}>
            <Save className="h-4 w-4" />
            Save
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(value);
              setSaved(false);
            }}
            disabled={!dirty}
          >
            <RotateCcw className="h-4 w-4" />
            Reset changes
          </Button>
          {saved && !dirty ? (
            <span className="inline-flex animate-pop items-center gap-1.5 text-sm font-medium text-success-600">
              <CheckCircle2 className="h-4 w-4" />
              Saved
            </span>
          ) : null}
        </div>

        <p className="mt-6 flex items-start gap-2 rounded-xl bg-olive-50 px-4 py-3 text-sm text-olive-800 ring-1 ring-inset ring-olive-100">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>New hosts start with this text.</span>
        </p>
      </Card>
    </div>
  );
}
