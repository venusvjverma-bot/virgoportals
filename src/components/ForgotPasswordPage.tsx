import { useState } from 'react';
import { ArrowLeft, ArrowRight, Mail, MailCheck } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { sendPasswordReset } from '@/lib/auth';

interface ForgotPasswordPageProps {
  onBack: () => void;
}

export function ForgotPasswordPage({ onBack }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Enter your email address first.');
      return;
    }
    setSending(true);
    try {
      await sendPasswordReset(email);
      // The response is identical whether or not the address has an account, so
      // this screen cannot be used to discover which emails are registered.
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset email.');
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthShell subtitle="Reset your password">
      <div className="rounded-3xl bg-white p-7 shadow-lift ring-1 ring-cream-200/80 sm:p-8">
        {sent ? (
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-olive-100 text-olive-700">
              <MailCheck className="h-6 w-6" />
            </span>
            <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight text-ink">
              Check your email
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              If an account exists for that address, we have sent a link to set a new password.
              The link works for a short time and can only be used once.
            </p>
            <Button variant="secondary" className="mt-6 w-full" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
              Forgot your password?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Enter the email on your account and we will send you a link to choose a new
              password.
            </p>

            <Field label="Email" htmlFor="reset-email" className="mt-6">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@restaurant.com"
                  className="pl-10"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (error) setError(null);
                  }}
                />
              </div>
            </Field>

            {error ? <Notice tone="error" className="mt-5">{error}</Notice> : null}

            <Button type="submit" className="mt-6 w-full" disabled={sending}>
              {sending ? 'Sending…' : 'Send reset link'}
              {!sending ? <ArrowRight className="h-4 w-4" /> : null}
            </Button>

            <button
              type="button"
              onClick={onBack}
              className="mt-5 block w-full text-center text-sm font-medium text-olive-700 transition-colors duration-200 hover:text-olive-800"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
