import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MailCheck,
  MapPin,
  UtensilsCrossed,
} from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { signUpHost, validateSignup } from '@/lib/hostSignup';
import { mascotUrl } from '@/lib/themeAssets';

interface HostSignupPageProps {
  onBack: () => void;
}

type DoneState = 'confirm-email' | 'sign-in-required' | null;

const FIELDS = [
  { key: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'you@restaurant.com', Icon: Mail },
  { key: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', placeholder: 'At least 8 characters', Icon: Lock },
  { key: 'confirmPassword', label: 'Confirm password', type: 'password', autoComplete: 'new-password', placeholder: 'Repeat your password', Icon: Lock },
  { key: 'restaurantName', label: 'Restaurant name', type: 'text', autoComplete: 'organization', placeholder: 'e.g. Olive & Thyme', Icon: UtensilsCrossed },
  { key: 'city', label: 'Location', type: 'text', autoComplete: 'address-level2', placeholder: 'e.g. Stockholm', Icon: MapPin },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];

export function HostSignupPage({ onBack }: HostSignupPageProps) {
  const [values, setValues] = useState<Record<FieldKey, string>>({
    email: '',
    password: '',
    confirmPassword: '',
    restaurantName: '',
    city: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DoneState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ password: false, confirmPassword: false });

  function update(key: FieldKey, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    if (error) setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const input = {
      email: values.email,
      password: values.password,
      confirmPassword: values.confirmPassword,
      restaurantName: values.restaurantName,
      city: values.city,
    };

    const invalid = validateSignup(input);
    if (invalid) {
      setError(invalid);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const { outcome } = await signUpHost(input);
      // 'signed-in' needs no screen of its own: the new session moves the app
      // straight to the host dashboard.
      if (outcome !== 'signed-in') setDone(outcome);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'We could not create your account. Please check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthShell subtitle="Become a host" animatedBg mascotUrl={mascotUrl()}>
        <div className="rounded-3xl bg-white p-7 text-center shadow-lift ring-1 ring-cream-200/80 sm:p-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-olive-100 text-olive-700">
            {done === 'confirm-email' ? (
              <MailCheck className="h-6 w-6" />
            ) : (
              <CheckCircle2 className="h-6 w-6" />
            )}
          </span>
          <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight text-ink">
            {done === 'confirm-email' ? 'Confirm your email' : 'Your account is ready'}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            {done === 'confirm-email'
              ? 'Your account and restaurant are set up. We have sent a confirmation link to your email address. Open it, then sign in to reach your host area.'
              : 'Your account and restaurant are set up. Sign in with your new email and password to open your host area.'}
          </p>
          <Button className="mt-6 w-full" onClick={onBack}>
            <ArrowRight className="h-4 w-4" />
            Go to sign in
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell subtitle="Become a host" animatedBg mascotUrl={mascotUrl()}>
      <form
        onSubmit={handleSubmit}
        noValidate
        className="rounded-3xl bg-white p-7 shadow-lift ring-1 ring-cream-200/80 sm:p-8"
      >
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Create your host account
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Set up your restaurant portal, upload your menu and share it with your guests.
        </p>

        <div className="mt-6 space-y-5">
          {FIELDS.map(({ key, label, type, autoComplete, placeholder, Icon }) => {
            const isPasswordField = key === 'password' || key === 'confirmPassword';
            const isVisible = isPasswordField && showPasswords[key];
            return (
            <Field key={key} label={label} htmlFor={`signup-${key}`}>
              <div className="relative">
                <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <Input
                  id={`signup-${key}`}
                  type={isPasswordField ? (isVisible ? 'text' : 'password') : type}
                  autoComplete={autoComplete}
                  placeholder={placeholder}
                  className={isPasswordField ? 'pl-10 pr-10' : 'pl-10'}
                  value={values[key]}
                  disabled={submitting}
                  onChange={(event) => update(key, event.target.value)}
                />
                {isPasswordField ? (
                  <button
                    type="button"
                    onClick={() => setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }))}
                    aria-label={isVisible ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint transition-colors duration-200 hover:text-ink-soft"
                  >
                    {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                ) : null}
              </div>
            </Field>
            );
          })}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-ink-muted">
          Use at least 8 characters, including one special character such as ! ? # or @.
        </p>

        {error ? (
          <Notice tone="error" className="mt-5">
            {error}
          </Notice>
        ) : null}

        <Button type="submit" className="mt-6 w-full" disabled={submitting}>
          {submitting ? 'Creating your account…' : 'Create your account'}
          {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
        </Button>

        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="mt-5 flex w-full items-center justify-center gap-2 text-sm font-medium text-olive-700 transition-colors duration-200 hover:text-olive-800 disabled:opacity-55"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </button>
      </form>
    </AuthShell>
  );
}
