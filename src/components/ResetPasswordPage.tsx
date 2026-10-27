import { useState } from 'react';
import { KeyRound, Lock, ShieldAlert } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { updatePassword } from '@/lib/auth';

const MIN_LENGTH = 8;

interface ResetPasswordPageProps {
  expired: boolean;
  onDone: () => void;
  onCancel: () => void;
}

export function ResetPasswordPage({ expired, onDone, onCancel }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Choose a password of at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await updatePassword(password);
      onDone();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'That reset link may have expired. Request a new one and try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (expired) {
    return (
      <AuthShell subtitle="Reset your password">
        <div className="rounded-3xl bg-white p-7 text-center shadow-lift ring-1 ring-cream-200/80 sm:p-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-error-50 text-error-600">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight text-ink">
            This link has expired
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Password reset links are time limited and can only be used once. Request a fresh link
            and use it right away.
          </p>
          <Button className="mt-6 w-full" onClick={onCancel}>
            Request a new link
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell subtitle="Choose a new password">
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl bg-white p-7 shadow-lift ring-1 ring-cream-200/80 sm:p-8"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-olive-100 text-olive-700">
          <KeyRound className="h-6 w-6" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight text-ink">
          Set a new password
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Pick something you have not used before. You will use it to sign in from now on.
        </p>

        <div className="mt-6 space-y-5">
          <Field label="New password" htmlFor="new-password">
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                placeholder={`At least ${MIN_LENGTH} characters`}
                className="pl-10"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError(null);
                }}
              />
            </div>
          </Field>

          <Field label="Confirm new password" htmlFor="confirm-password">
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat your new password"
                className="pl-10"
                value={confirm}
                onChange={(event) => {
                  setConfirm(event.target.value);
                  if (error) setError(null);
                }}
              />
            </div>
          </Field>
        </div>

        {error ? <Notice tone="error" className="mt-5">{error}</Notice> : null}

        <Button type="submit" className="mt-6 w-full" disabled={saving}>
          {saving ? 'Saving…' : 'Save new password'}
        </Button>

        <button
          type="button"
          onClick={onCancel}
          className="mt-5 block w-full text-center text-sm font-medium text-olive-700 transition-colors duration-200 hover:text-olive-800"
        >
          Back to sign in
        </button>
      </form>
    </AuthShell>
  );
}
