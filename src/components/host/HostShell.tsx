import { useEffect, useState } from 'react';
import { BarChart3, Calendar, CreditCard, LayoutGrid, LogOut, Menu, Printer, QrCode, ScrollText, ShoppingBag, Sparkles, Store, X } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { HostView } from '@/types';

interface NavItem {
  id: HostView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Store },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
  { id: 'departments', label: 'Departments', icon: LayoutGrid },
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'printer-setup', label: 'Printer Setup', icon: Printer },
];

const TITLES: Partial<Record<HostView, { title: string; subtitle: string }>> = {
  dashboard: { title: 'Dashboard', subtitle: 'How your portal introduces itself to guests.' },
  subscription: { title: 'Subscription', subtitle: 'Your plan, billing period and payment history.' },
  orders: { title: 'Orders', subtitle: 'Incoming test orders from visitors, updated live.' },
  reports: { title: 'Reports', subtitle: 'Department sessions and order totals.' },
  'printer-setup': { title: 'Printer Setup', subtitle: 'Install the printing app and connect your receipt printers.' },
};

interface HostShellProps {
  active: HostView;
  onSelect: (view: HostView) => void;
  restaurantName: string;
  restaurantTimezone: string;
  onLogout: () => void;
  children: React.ReactNode;
}

function formatDashboardDateTime(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  return `${values.get('hour')}:${values.get('minute')} | ${values.get('day')}-${values.get('month')}-${values.get('year')}`;
}

export function HostShell({
  active,
  onSelect,
  restaurantName,
  restaurantTimezone,
  onLogout,
  children,
}: HostShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const heading = TITLES[active] ?? { title: '', subtitle: '' };

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-cream-100">
      {navOpen ? (
        <button
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 animate-fade-in bg-ink/30 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-olive-700 transition-transform duration-300 ease-out lg:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3">
            <LogoMark className="h-9 w-9 text-cream-100" />
            <span className="font-display text-base font-semibold tracking-tight text-cream-100">
              Virgo Portals
            </span>
          </div>
          <button
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
            className="rounded-lg p-1.5 text-cream-200 transition-colors duration-200 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-4 mb-2 rounded-xl bg-white/8 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-olive-200/80">Signed in as host</p>
          <p className="mt-0.5 truncate text-sm font-medium text-cream-100">{restaurantName}</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2 scrollbar-soft">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === active || (active === 'department-detail' && item.id === 'departments') || (active === 'event-detail' && item.id === 'events') || (active === 'order-detail' && item.id === 'orders');
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelect(item.id);
                  setNavOpen(false);
                }}
                className={cn(
                  'group relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-white/10 text-white shadow-inset'
                    : 'text-olive-100 hover:bg-white/10 hover:text-white'
                )}
              >
                <span
                  className={cn(
                    'absolute left-0 h-6 w-1 rounded-r-full bg-cream-100 transition-opacity duration-200',
                    isActive ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <Icon
                  className={cn(
                    'h-4 w-4 transition-transform duration-200 group-hover:scale-105',
                    isActive ? 'text-cream-100' : 'text-olive-200'
                  )}
                />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-cream-200 bg-cream-100/85 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setNavOpen(true)}
                aria-label="Open navigation"
                className="rounded-xl p-2 text-ink-soft transition-colors duration-200 hover:bg-cream-200 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-ink shadow-soft ring-1 ring-cream-200">
                <span className="h-1.5 w-1.5 rounded-full bg-olive-500" />
                Host
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>

        <main className="px-5 py-7 sm:px-8 sm:py-9">
          <div className="mx-auto max-w-5xl">
            {heading.title ? (
              <div className="mb-7">
                {active === 'dashboard' ? (
                  <p className="mb-2 text-xs text-ink-faint">
                    {formatDashboardDateTime(currentTime, restaurantTimezone)}
                  </p>
                ) : null}
                <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
                  {heading.title}
                </h1>
                <p className="mt-1.5 text-sm text-ink-muted">{heading.subtitle}</p>
              </div>
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export { QrCode, ScrollText, Sparkles };
