import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, PlayCircle } from 'lucide-react';
import { AuthShell } from '@/components/AuthShell';
import { FeatureShowcase } from '@/components/FeatureShowcase';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { mascotUrl } from '@/lib/themeAssets';

interface LoginPageProps {
  onSubmit: (email: string, password: string) => void;
  error: string | null;
  notice: string | null;
  clearError: () => void;
  onForgotPassword: () => void;
  onBecomeHost: () => void;
  onOpenPresentation: () => void;
}

export function LoginPage({
  onSubmit,
  error,
  notice,
  clearError,
  onForgotPassword,
  onBecomeHost,
  onOpenPresentation,
}: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showAboutUs, setShowAboutUs] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(email, password);
  }

  return (
    <>
    <AuthShell subtitle="Restaurant menu portals" animatedBg mascotUrl={mascotUrl()} wide>
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-3xl bg-white p-7 shadow-lift ring-1 ring-cream-200/80 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Field label="Email" htmlFor="email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@restaurant.com"
                    className="pl-10"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (error || notice) clearError();
                    }}
                  />
                </div>
              </Field>
            </div>

            <div>
              <Field label="Password" htmlFor="password">
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="pl-10 pr-10"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (error || notice) clearError();
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint transition-colors duration-200 hover:text-ink-soft"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
            </div>

            {error ? <Notice tone="error">{error}</Notice> : null}
            {notice ? <Notice tone="success">{notice}</Notice> : null}

            <Button type="submit" className="w-full">
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <button
            type="button"
            onClick={onForgotPassword}
            className="mt-5 block w-full text-center text-sm font-medium text-olive-700 transition-colors duration-200 hover:text-olive-800"
          >
            Forgot your password?
          </button>
        </div>
      </div>

      <FeatureShowcase />

      <button
        type="button"
        onClick={onOpenPresentation}
        className="group animate-bubble-pulse mx-auto mt-12 flex w-full max-w-md items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-soft ring-1 ring-cream-200/80 transition hover:-translate-y-0.5 hover:shadow-lift"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-olive-700 text-cream-50 transition group-hover:bg-olive-800">
          <PlayCircle className="h-6 w-6" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-lg font-semibold tracking-tight text-ink">
            Take the interactive tour
          </span>
          <span className="mt-0.5 block text-sm leading-relaxed text-ink-muted">
            See the full Host and guest journey, chapter by chapter.
          </span>
        </span>
        <ArrowRight className="ml-auto h-5 w-5 shrink-0 text-olive-600 transition-transform group-hover:translate-x-1" />
      </button>

      <div className="mx-auto mt-12 w-full max-w-md rounded-3xl bg-white/70 p-5 text-center ring-1 ring-cream-200/80 backdrop-blur">
        <p className="text-sm font-medium text-ink">Run a restaurant?</p>
        <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={onBecomeHost}>
          Become a host
        </Button>
        <button
          type="button"
          onClick={() => setShowAboutUs(true)}
          className="mt-4 text-sm font-medium text-olive-700 underline underline-offset-4 transition-colors hover:text-olive-800"
        >
          About Us
        </button>
      </div>
    </AuthShell>

    {showAboutUs ? (
      <div
        className="fixed inset-0 z-[60] flex flex-col bg-cream-100 animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-label="About Us"
      >
        <header className="flex items-center gap-3 border-b border-cream-200 bg-cream-50 px-5 py-4">
          <button
            type="button"
            onClick={() => setShowAboutUs(false)}
            aria-label="Back to login"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink-soft shadow-soft ring-1 ring-cream-200 transition-all duration-200 hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">About Us</h2>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-soft">
          <article className="mx-auto max-w-2xl px-5 py-8 sm:py-10">
            <div className="mb-8 border-b border-cream-200 pb-6">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                About Virgo Portals
              </h1>
              <p className="mt-1 text-sm font-medium text-ink-muted">
                A Smarter Way to Connect with Your Guests
              </p>
            </div>

            <section className="mb-8">
              <h2 className="font-display text-base font-semibold text-ink sm:text-lg">What is Virgo Portals?</h2>
              <div className="mt-3 space-y-3">
                <p className="text-sm leading-relaxed text-ink-soft">
                  Virgo Portals is an AI-powered digital platform designed for restaurants and hospitality businesses. It brings digital menus, guest assistance, online ordering and payment solutions together in one connected experience.
                </p>
                <p className="text-sm leading-relaxed text-ink-soft">
                  Guests can access a restaurant’s menu, explore dishes, get assistance and place orders from their own mobile devices.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-base font-semibold text-ink sm:text-lg">What We Offer</h2>
              <div className="mt-3 space-y-3">
                <h3 className="pt-1 text-sm font-semibold text-ink">Digital Menus & QR Access</h3>
                <p className="text-sm leading-relaxed text-ink-soft">Guests can scan a QR code to open a restaurant’s digital menu directly on their mobile devices.</p>
                <h3 className="pt-1 text-sm font-semibold text-ink">AI-Powered Guest Assistance</h3>
                <p className="text-sm leading-relaxed text-ink-soft">The AI-powered Visitor Chat helps guests explore menu options, ask questions and discover relevant dishes and recommendations.</p>
                <h3 className="pt-1 text-sm font-semibold text-ink">Online Ordering</h3>
                <p className="text-sm leading-relaxed text-ink-soft">Guests can select menu items, choose available options and add-ons, manage their basket and submit orders through checkout.</p>
                <h3 className="pt-1 text-sm font-semibold text-ink">Online Payments</h3>
                <p className="text-sm leading-relaxed text-ink-soft">The platform supports integrated online payment solutions, allowing guests to pay using the payment methods made available during checkout.</p>
                <h3 className="pt-1 text-sm font-semibold text-ink">Restaurant Management Tools</h3>
                <p className="text-sm leading-relaxed text-ink-soft">The Host Dashboard gives restaurant operators tools to manage menus, orders and platform features.</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-base font-semibold text-ink sm:text-lg">Our Purpose</h2>
              <div className="mt-3 space-y-3">
                <p className="text-sm leading-relaxed text-ink-soft">
                  We aim to make restaurant interactions simpler by bringing menu discovery, guest assistance, ordering and payments into one connected digital experience.
                </p>
                <p className="text-sm leading-relaxed text-ink-soft">
                  We believe technology should make hospitality more convenient for businesses and their guests, while allowing restaurants to focus on delivering great experiences.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="font-display text-base font-semibold text-ink sm:text-lg">Operated by Virgo Imagination</h2>
              <div className="mt-3 space-y-3">
                <p className="text-sm leading-relaxed text-ink-soft">
                  Virgo Portals is developed and operated by Virgo Imagination, an independent digital business based in Sweden, focused on developing innovative digital products and AI-powered platforms.
                </p>
              </div>
            </section>
          </article>
        </div>
      </div>
    ) : null}
    </>
  );
}
