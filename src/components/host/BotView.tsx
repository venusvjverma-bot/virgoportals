import { useEffect, useState } from 'react';
import { CheckCircle2, Info, Pencil, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';

interface BotViewProps {
  adminDefault: string;
  value: string;
  onSave: (text: string) => Promise<void>;
}

export function BotView({ adminDefault, value, onSave }: BotViewProps) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
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
      setError(err instanceof Error ? err.message : 'Could not save your bot text.');
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

  async function handleRestore() {
    if (dirty && editing) {
      setConfirmRestore(true);
      return;
    }
    setConfirmRestore(true);
  }

  async function confirmRestoreDefault() {
    setRestoreError(null);
    setRestoring(true);
    try {
      await onSave(adminDefault);
      setEditing(false);
      setConfirmRestore(false);
      setState('saved');
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Could not restore the admin default.');
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <Card className="animate-fade-in">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
          About your AI assistant's system prompt
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft">
          <p>
            This section contains the instructions that guide your AI assistant on the visitor chat
            page. Changes made here can affect how your assistant presents menu items, answers
            questions, explains ingredients and allergens, and recommends dishes or drinks.
          </p>
          <p>
            Please make changes carefully. Incorrect or unclear instructions may cause unexpected
            assistant behavior or make the assistant provide information that does not match your
            restaurant's approved menu.
          </p>
          <ul className="ml-4 list-disc space-y-1.5">
            <li>Keep the assistant focused on presenting your restaurant's menu.</li>
            <li>Ensure that answers are grounded in your restaurant's approved menu data.</li>
            <li>
              Do not instruct the assistant to invent dishes, prices, ingredients, or allergen
              information.
            </li>
            <li>Preserve the existing menu-only scope and applicable safety instructions.</li>
            <li>Test the visitor chat after making changes.</li>
          </ul>
          <p>
            If you are unsure what a prompt instruction means or how it may affect your assistant,
            contact your administrator before changing it.
          </p>
        </div>
      </Card>

      <Card className="animate-fade-in">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
          Your bot instructions
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          This started from the admin default. Edit it and save to use your own version — the
          admin default is never changed.
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
                onClick={handleRestore}
                disabled={state === 'saving' || restoring}
              >
                <RotateCcw className="h-4 w-4" />
                Use admin default
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

        <p className="mt-6 flex items-start gap-2 rounded-xl bg-olive-50 px-4 py-3 text-sm text-olive-800 ring-1 ring-inset ring-olive-100">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            The admin default currently reads: &ldquo;{adminDefault.slice(0, 90)}
            {adminDefault.length > 90 ? '…' : ''}&rdquo;
          </span>
        </p>
      </Card>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard unsaved changes?"
        confirmLabel="Discard changes"
        tone="danger"
        onConfirm={confirmDiscardEdits}
        onCancel={() => setConfirmDiscard(false)}
      >
        <p>
          You have unsaved edits to your system prompt. Leaving edit mode will discard them and
          restore your last saved prompt.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmRestore}
        title="Restore the admin default prompt?"
        confirmLabel="Restore default"
        tone="primary"
        onConfirm={confirmRestoreDefault}
        onCancel={() => setConfirmRestore(false)}
        busy={restoring}
      >
        <div className="space-y-3">
          <p>
            You are about to replace your current custom system prompt with the
            administrator's default prompt.
          </p>
          <p className="font-medium text-ink">
            Important: Your current custom prompt may be permanently lost. Restoring the admin
            default will not automatically recover your previous custom instructions.
          </p>
          <p>
            This change may affect how your AI assistant behaves on the visitor chat page. Please
            make sure you understand the consequences before continuing.
          </p>
          {dirty && editing ? (
            <p className="rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-700">
              You have unsaved edits. Restoring the admin default will discard them.
            </p>
          ) : null}
          {restoreError ? (
            <Notice tone="error">{restoreError}</Notice>
          ) : null}
        </div>
      </ConfirmDialog>
    </div>
  );
}
