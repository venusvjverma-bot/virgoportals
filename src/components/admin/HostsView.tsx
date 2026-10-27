import { useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Plus,
  Store,
  UserPlus,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, Field } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { cn } from '@/lib/cn';
import type { Host } from '@/types';

interface HostsViewProps {
  hosts: Host[];
  onToggleStatus: (id: string) => void;
  onCreateHost: (input: {
    email: string;
    password: string;
    restaurantName: string;
    city: string;
  }) => Promise<void>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function HostsView({ hosts, onToggleStatus, onCreateHost }: HostsViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return hosts;
    return hosts.filter(
      (host) =>
        host.restaurant.toLowerCase().includes(needle) ||
        host.email.toLowerCase().includes(needle) ||
        host.city.toLowerCase().includes(needle)
    );
  }, [hosts, query]);

  const selected = hosts.find((host) => host.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <Card padded={false} className="animate-fade-in overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-cream-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
              Hosts
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {hosts.length} restaurants with a Virgo portal.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search restaurant, email, or city"
              className="w-full rounded-xl border-0 bg-cream-50 px-4 py-2.5 text-sm text-ink ring-1 ring-inset ring-cream-300 placeholder:text-ink-faint transition-all duration-200 hover:ring-olive-200 focus:bg-white focus:ring-2 focus:ring-olive-500 sm:max-w-xs"
            />
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New host
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-soft">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-cream-200 bg-cream-50/60">
                {['Restaurant', 'Email', 'City', 'Signup date', 'Dishes', 'Status', ''].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-ink-muted"
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200">
              {filtered.map((host) => (
                <tr
                  key={host.id}
                  onClick={() => setSelectedId(host.id)}
                  className="cursor-pointer transition-colors duration-150 hover:bg-cream-50"
                >
                  <td className="px-6 py-4 text-sm font-medium text-ink">{host.restaurant}</td>
                  <td className="px-6 py-4 text-sm text-ink-soft">{host.email}</td>
                  <td className="px-6 py-4 text-sm text-ink-soft">{host.city}</td>
                  <td className="px-6 py-4 text-sm text-ink-soft">{formatDate(host.signupDate)}</td>
                  <td className="px-6 py-4 text-sm text-ink-soft">{host.dishes}</td>
                  <td className="px-6 py-4">
                    <Badge tone={host.status === 'Active' ? 'success' : 'error'}>
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          host.status === 'Active' ? 'bg-success-500' : 'bg-error-500'
                        )}
                      />
                      {host.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-medium text-olive-600">
                    Open
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-ink-muted">
                    No restaurants match that search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {selected ? (
        <HostDrawer
          host={selected}
          onClose={() => setSelectedId(null)}
          onToggleStatus={() => onToggleStatus(selected.id)}
        />
      ) : null}

      {creating ? (
        <CreateHostDrawer
          onClose={() => setCreating(false)}
          onCreate={async (input) => {
            await onCreateHost(input);
            setCreating(false);
          }}
        />
      ) : null}
    </div>
  );
}

interface HostDrawerProps {
  host: Host;
  onClose: () => void;
  onToggleStatus: () => void;
}

function HostDrawer({ host, onClose, onToggleStatus }: HostDrawerProps) {
  const blocked = host.status === 'Blocked';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close host details"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-ink/25 backdrop-blur-[2px]"
      />
      <aside className="relative flex h-full w-full max-w-lg animate-slide-in-right flex-col bg-white shadow-lift">
        <header className="flex items-start justify-between gap-4 border-b border-cream-200 px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Host details
            </p>
            <h2 className="mt-1 truncate font-display text-2xl font-semibold tracking-tight text-ink">
              {host.restaurant}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {host.email} · {host.city}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-ink-muted transition-colors duration-200 hover:bg-cream-100 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6 scrollbar-soft">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-cream-50 p-4 ring-1 ring-inset ring-cream-200">
              <p className="text-xs uppercase tracking-wide text-ink-muted">Dishes</p>
              <p className="mt-1 font-display text-2xl font-semibold text-ink">{host.dishes}</p>
            </div>
            <div className="rounded-xl bg-cream-50 p-4 ring-1 ring-inset ring-cream-200">
              <p className="text-xs uppercase tracking-wide text-ink-muted">Status</p>
              <div className="mt-1.5">
                <Badge tone={blocked ? 'error' : 'success'}>{host.status}</Badge>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Welcome text
            </p>
            <p className="mt-2 rounded-xl bg-cream-50 p-4 text-sm leading-relaxed text-ink-soft ring-1 ring-inset ring-cream-200">
              {host.welcomeText}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Bot prompt
            </p>
            <p className="mt-2 rounded-xl bg-cream-50 p-4 text-sm leading-relaxed text-ink-soft ring-1 ring-inset ring-cream-200">
              {host.botPrompt}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Visitor link
            </p>
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-cream-50 px-4 py-3 ring-1 ring-inset ring-cream-200">
              <ExternalLink className="h-4 w-4 shrink-0 text-olive-500" />
              <span className="truncate text-sm text-olive-700">{host.visitorLink}</span>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-cream-200 px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant={blocked ? 'primary' : 'danger'} onClick={onToggleStatus}>
            {blocked ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Unblock
              </>
            ) : (
              <>
                <Ban className="h-4 w-4" />
                Block
              </>
            )}
          </Button>
        </footer>
      </aside>
    </div>
  );
}

interface CreateHostDrawerProps {
  onClose: () => void;
  onCreate: (input: {
    email: string;
    password: string;
    restaurantName: string;
    city: string;
  }) => Promise<void>;
}

function CreateHostDrawer({ onClose, onCreate }: CreateHostDrawerProps) {
  const [restaurantName, setRestaurantName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!restaurantName.trim()) {
      setError('Add the restaurant name.');
      return;
    }
    if (!email.trim().includes('@')) {
      setError('Add a valid email address for the host.');
      return;
    }
    if (password.length < 8) {
      setError('Choose a password of at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      await onCreate({
        email: email.trim().toLowerCase(),
        password,
        restaurantName: restaurantName.trim(),
        city: city.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the host account.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close new host form"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-ink/25 backdrop-blur-[2px]"
      />
      <aside className="relative flex h-full w-full max-w-lg animate-slide-in-right flex-col bg-white shadow-lift">
        <header className="flex items-start justify-between gap-4 border-b border-cream-200 px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-olive-100 text-olive-700">
              <UserPlus className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                New host
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
                Create a host account
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-ink-muted transition-colors duration-200 hover:bg-cream-100 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6 scrollbar-soft">
            <p className="text-sm leading-relaxed text-ink-muted">
              This creates the host's sign-in and links it to a new restaurant in one step. Share
              the password with the host and ask them to change it from the sign-in screen.
            </p>

            <Field label="Restaurant name" htmlFor="new-restaurant">
              <div className="relative">
                <Store className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <Input
                  id="new-restaurant"
                  className="pl-10"
                  placeholder="Olive & Thyme"
                  value={restaurantName}
                  onChange={(event) => {
                    setRestaurantName(event.target.value);
                    if (error) setError(null);
                  }}
                />
              </div>
            </Field>

            <Field label="City" htmlFor="new-city">
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <Input
                  id="new-city"
                  className="pl-10"
                  placeholder="Portland"
                  value={city}
                  onChange={(event) => {
                    setCity(event.target.value);
                    if (error) setError(null);
                  }}
                />
              </div>
            </Field>

            <Field label="Host email" htmlFor="new-email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <Input
                  id="new-email"
                  type="email"
                  autoComplete="off"
                  className="pl-10"
                  placeholder="host@restaurant.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (error) setError(null);
                  }}
                />
              </div>
            </Field>

            <Field
              label="Temporary password"
              htmlFor="new-password"
              hint="At least 8 characters. The host can change it later."
            >
              <Input
                id="new-password"
                type="text"
                autoComplete="off"
                placeholder="A password you will share with the host"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError(null);
                }}
              />
            </Field>

            {error ? <Notice tone="error">{error}</Notice> : null}
          </div>

          <footer className="flex items-center justify-end gap-3 border-t border-cream-200 px-6 py-4">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Create host
                </>
              )}
            </Button>
          </footer>
        </form>
      </aside>
    </div>
  );
}
