import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Sidebar, Topbar } from '@/components/admin/AdminShell';
import { HomeView } from '@/components/admin/HomeView';
import { HostsView } from '@/components/admin/HostsView';
import { CreditsView } from '@/components/admin/CreditsView';
import { SubscriptionsView } from '@/components/admin/SubscriptionsView';
import { ModelConfigView, type TestResult } from '@/components/admin/ModelConfigView';
import { BotTextView } from '@/components/admin/BotTextView';
import { UsageView } from '@/components/admin/UsageView';
import { ThemeView } from '@/components/admin/ThemeView';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import {
  adminCreateHost,
  adminGetBotText,
  adminListHosts,
  adminListUsage,
  adminReadModels,
  adminSaveBotText,
  adminSaveModel,
  adminSetHostStatus,
  adminTestModel,
  type ModelKind,
} from '@/lib/adminApi';
import type { AdminModels, AdminView, Host, ModelConfig, UsageRow } from '@/types';

interface AdminDashboardProps {
  onLogout: () => void;
}

const TITLES: Record<AdminView, { title: string; subtitle: string }> = {
  home: { title: 'Home', subtitle: 'A quick read on how every portal is doing.' },
  hosts: { title: 'Hosts', subtitle: 'Every restaurant with a Virgo portal.' },
  credits: { title: 'Credit Controller', subtitle: 'Manage LLM credits for every host.' },
  subscriptions: { title: 'Subscriptions', subtitle: 'Read-only monitoring of host subscriptions and payments.' },
  chat: { title: 'Chat model', subtitle: 'One model behind every host conversation.' },
  image: { title: 'Image model', subtitle: 'Dish image generation settings.' },
  extract: { title: 'Menu AI Extraction model', subtitle: 'The model that reads uploaded menus. Shares its connection with the chat model.' },
  bot: { title: 'Default bot text', subtitle: 'The prompt new hosts start from.' },
  usage: { title: 'Usage', subtitle: 'All-time activity across restaurant portals.' },
  theme: { title: 'Theme uploader', subtitle: 'Upload and manage theme images.' },
};

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [view, setView] = useState<AdminView>('home');
  const [navOpen, setNavOpen] = useState(false);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [models, setModels] = useState<AdminModels | null>(null);
  const [botText, setBotText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Every admin read and write goes through the admin service, which verifies
  // the signed-in account against the server-side admin allowlist itself. The
  // dashboard never talks to the sensitive tables directly.
  const load = useCallback(async () => {
    const [loadedHosts, loadedUsage, loadedBot, loadedModels] = await Promise.all([
      adminListHosts(),
      adminListUsage(),
      adminGetBotText(),
      adminReadModels(),
    ]);
    setHosts(loadedHosts);
    setUsage(loadedUsage);
    setBotText(loadedBot);
    setModels(loadedModels);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not load the dashboard.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [load]);

  async function toggleHostStatus(id: string) {
    const host = hosts.find((item) => item.id === id);
    if (!host) return;
    const next = host.status === 'Active' ? 'Blocked' : 'Active';
    setHosts((current) =>
      current.map((item) => (item.id === id ? { ...item, status: next } : item))
    );
    try {
      await adminSetHostStatus(id, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that host.');
      await load();
    }
  }

  async function handleSaveBotText(text: string) {
    await adminSaveBotText(text);
    setBotText(text);
  }

  async function handleSaveModel(kind: ModelKind, config: ModelConfig) {
    const saved = await adminSaveModel(kind, config);
    const modelKey = kind === 'image' ? 'imageModel' : kind === 'extract' ? 'extractModel' : 'chatModel';
    setModels((current) => (current ? { ...current, [modelKey]: saved } : current));
  }

  async function handleTestModel(kind: ModelKind): Promise<TestResult> {
    const result = await adminTestModel(kind);
    return { reply: result.reply, imageUrl: result.imageUrl, notice: result.notice };
  }

  async function handleCreateHost(input: {
    email: string;
    password: string;
    restaurantName: string;
    city: string;
  }): Promise<void> {
    await adminCreateHost(input);
    await load();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-100">
        <div className="flex items-center gap-3 text-sm text-ink-muted">
          <Loader2 className="h-5 w-5 animate-spin text-olive-600" />
          Loading dashboard…
        </div>
      </div>
    );
  }

  if (error || !models) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-100 px-5">
        <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-7 shadow-soft ring-1 ring-cream-200">
          <h1 className="font-display text-xl font-semibold text-ink">
            We could not load the dashboard
          </h1>
          <Notice tone="error">{error ?? 'The dashboard data was unavailable.'}</Notice>
          <Button variant="secondary" onClick={onLogout}>
            Logout
          </Button>
        </div>
      </div>
    );
  }

  const heading = TITLES[view];

  return (
    <div className="min-h-screen bg-cream-100">
      <Sidebar
        active={view}
        onSelect={setView}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />

      <div className="lg:pl-72">
        <Topbar onOpenNav={() => setNavOpen(true)} onLogout={onLogout} />

        <main className="px-5 py-7 sm:px-8 sm:py-9">
          <div className="mx-auto max-w-6xl">
            <div className="mb-7">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
                {heading.title}
              </h1>
              <p className="mt-1.5 text-sm text-ink-muted">{heading.subtitle}</p>
            </div>

            {view === 'home' ? <HomeView hosts={hosts} usage={usage} /> : null}
            {view === 'hosts' ? (
              <HostsView
                hosts={hosts}
                onToggleStatus={toggleHostStatus}
                onCreateHost={handleCreateHost}
              />
            ) : null}
            {view === 'credits' ? <CreditsView /> : null}
            {view === 'subscriptions' ? <SubscriptionsView /> : null}
            {view === 'chat' ? (
              <ModelConfigView
                kind="chat"
                config={models.chatModel}
                onSave={(config) => handleSaveModel('chat', config)}
                onTest={() => handleTestModel('chat')}
              />
            ) : null}
            {view === 'image' ? (
              <ModelConfigView
                kind="image"
                config={models.imageModel}
                onSave={(config) => handleSaveModel('image', config)}
                onTest={() => handleTestModel('image')}
              />
            ) : null}
            {view === 'extract' ? (
              <ModelConfigView
                kind="extract"
                config={models.extractModel}
                sharedConnection={{
                  provider: models.chatModel.provider,
                  endpoint: models.chatModel.endpoint,
                  hasApiKey: models.chatModel.hasApiKey,
                }}
                onSave={(config) => handleSaveModel('extract', config)}
                onTest={() => handleTestModel('extract')}
              />
            ) : null}
            {view === 'bot' ? <BotTextView value={botText} onSave={handleSaveBotText} /> : null}
            {view === 'usage' ? <UsageView /> : null}
            {view === 'theme' ? <ThemeView /> : null}
          </div>
        </main>
      </div>
    </div>
  );
}
