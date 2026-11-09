import { useEffect, useState } from 'react';
import { CheckCircle2, Info, Pencil, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';

interface BotTextViewProps {
  value: string;
  onSave: (text: string) => Promise<void> | void;
}

export function BotTextView({ value, onSave }: BotTextViewProps) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    setDraft(value);
    setState('idle');
    setError(null);
  }, [value]);

  const dirty = draft !== value;

  async function handleSave() {
    setError(null);
    setState('saving');
    try {
      await onSave(draft);
      setState('saved');
      setEditing(false);
    } catch (err) {
      setState('idle');
      setError(err instanceof Error ? err.message : 'Could not save the default bot text.');
    }
  }

  function handleEdit() {
    setDraft(value);
    setState('idle');
    setError(null);
    setEditing(true);
  }

  function handleCancel() {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    setDraft(value);
    setState('idle');
    setError(null);
    setEditing(false);
  }

  function confirmDiscardEdits() {
    setDraft(value);
    setState('idle');
    setError(null);
    setConfirmDiscard(false);
    setEditing(false);
  }

  function resetChanges() {
    setDraft(value);
    setState('idle');
    setError(null);
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

        {editing ? (
          <>
            <Textarea
              className="mt-5 min-h-[240px] font-mono text-[13px]"
              value={draft}
              spellCheck={false}
              onChange={(event) => {
                setDraft(event.target.value);
                setState('idle');
              }}
            />

            {error ? <Notice tone="error" className="mt-4">{error}</Notice> : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={handleSave} disabled={!dirty || state === 'saving'}>
                <Save className="h-4 w-4" />
                {state === 'saving' ? 'Saving…' : 'Save changes'}
              </Button>
              <Button
                variant="secondary"
                onClick={handleCancel}
                disabled={state === 'saving'}
              >
                Cancel
              </Button>
              {state === 'saved' && !dirty ? (
                <span className="inline-flex animate-pop items-center gap-1.5 text-sm font-medium text-success-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Saved
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="mt-5 rounded-xl bg-cream-50 p-4 ring-1 ring-inset ring-cream-200">
              <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-ink-soft">
                {value || '(empty)'}
              </pre>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={handleEdit}>
                <Pencil className="h-4 w-4" />
                Edit prompt
              </Button>
              <Button
                variant="secondary"
                onClick={resetChanges}
                disabled={state === 'saving'}
              >
                <RotateCcw className="h-4 w-4" />
                Reset changes
              </Button>
              {state === 'saved' ? (
                <span className="inline-flex animate-pop items-center gap-1.5 text-sm font-medium text-success-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Saved
                </span>
              ) : null}
            </div>
          </>
        )}

        <ConfirmDialog
          open={confirmDiscard}
          title="Discard unsaved changes?"
          confirmLabel="Discard changes"
          tone="danger"
          onConfirm={confirmDiscardEdits}
          onCancel={() => setConfirmDiscard(false)}
        >
          <p>
            You have unsaved edits to the default bot text. Leaving edit mode will discard them and
            restore the last saved text.
          </p>
        </ConfirmDialog>

        <p className="mt-6 flex items-start gap-2 rounded-xl bg-olive-50 px-4 py-3 text-sm text-olive-800 ring-1 ring-inset ring-olive-100">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>New hosts start with this text.</span>
        </p>
      </Card>
    </div>
  );
}
