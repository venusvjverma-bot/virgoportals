import { LogOut, Sparkles } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { Button } from '@/components/ui/Button';

interface HostHomeProps {
  email: string;
  onLogout: () => void;
}

export function HostHome({ email, onLogout }: HostHomeProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-cream-200 bg-cream-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <LogoMark className="h-9 w-9 text-olive-700" />
            <span className="font-display text-base font-semibold tracking-tight text-ink">
              Virgo Portals
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-muted sm:block">{email}</span>
            <Button variant="secondary" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-lg animate-fade-in rounded-3xl bg-white p-10 text-center shadow-soft ring-1 ring-cream-200/80">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-olive-100 text-olive-700">
            <Sparkles className="h-7 w-7" />
          </span>
          <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight text-ink">
            Host area coming next
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Your menu portal, dish uploads, and visitor chat will live here. Nothing else is
            available in this area yet.
          </p>
        </div>
      </main>
    </div>
  );
}
