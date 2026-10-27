import { ChevronRight, ImageIcon, MessageSquare, UtensilsCrossed, Users } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/admin/StatCard';
import type { Host, UsageRow } from '@/types';

interface HomeViewProps {
  hosts: Host[];
  usage: UsageRow[];
}

export function HomeView({ hosts, usage }: HomeViewProps) {
  const imagesGenerated = usage.reduce((total, row) => total + row.images, 0);
  const visitorChats = usage.reduce((total, row) => total + row.messages, 0);
  const dishes = hosts.reduce((total, host) => total + host.dishes, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Hosts"
          value={hosts.length}
          icon={<Users className="h-5 w-5" />}
          accent="olive"
          index={0}
        />
        <StatCard
          label="Dishes"
          value={dishes}
          icon={<UtensilsCrossed className="h-5 w-5" />}
          accent="success"
          index={1}
        />
        <StatCard
          label="Images generated"
          value={imagesGenerated}
          icon={<ImageIcon className="h-5 w-5" />}
          accent="warning"
          index={2}
        />
        <StatCard
          label="Visitor chats"
          value={visitorChats}
          icon={<MessageSquare className="h-5 w-5" />}
          accent="neutral"
          index={3}
        />
      </div>

      <Card padded={false} className="animate-fade-in overflow-hidden">
        <div className="flex items-center justify-between border-b border-cream-200 px-6 py-5">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
              Busiest portals
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              Where visitors are chatting the most right now.
            </p>
          </div>
        </div>
        <ul className="divide-y divide-cream-200">
          {[...usage]
            .sort((a, b) => b.messages - a.messages)
            .map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-4 px-6 py-4 transition-colors duration-200 hover:bg-cream-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{row.host}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {row.uploads} uploads · {row.images} images
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-sm text-ink-soft">
                  <span className="font-medium">{row.messages.toLocaleString()}</span>
                  <span className="text-ink-muted">chats</span>
                  <ChevronRight className="h-4 w-4 text-ink-faint" />
                </div>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}
