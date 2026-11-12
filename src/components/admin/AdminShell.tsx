import {
  BarChart3,
  Coins,
  CreditCard,
  FileText,
  Home,
  ImageIcon,
  LogOut,
  Menu,
  Palette,
  Sparkles,
  Users,
  X,
  FileSearch,
} from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { AdminView } from '@/types';

interface NavItem {
  id: AdminView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'hosts', label: 'Hosts', icon: Users },
  { id: 'credits', label: 'Credit Controller', icon: Coins },
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  { id: 'chat', label: 'Chat model', icon: Sparkles },
  { id: 'extract', label: 'Menu AI Extraction', icon: FileSearch },
  { id: 'image', label: 'Image model', icon: ImageIcon },
  { id: 'bot', label: 'Default bot text', icon: FileText },
  { id: 'usage', label: 'Usage', icon: BarChart3 },
  { id: 'theme', label: 'Theme uploader', icon: Palette },
];

interface SidebarProps {
  active: AdminView;
  onSelect: (view: AdminView) => void;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ active, onSelect, open, onClose }: SidebarProps) {
  return (
    <>
      {open ? (
        <button
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-30 animate-fade-in bg-ink/30 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-olive-700 transition-transform duration-300 ease-out lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
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
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-lg p-1.5 text-cream-200 transition-colors duration-200 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2 scrollbar-soft">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === active;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelect(item.id);
                  onClose();
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

        <div className="px-6 py-6">
          <p className="text-xs text-olive-200/80">Restaurant menu portals</p>
        </div>
      </aside>
    </>
  );
}

interface TopbarProps {
  onOpenNav: () => void;
  onLogout: () => void;
}

export function Topbar({ onOpenNav, onLogout }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-cream-200 bg-cream-100/85 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenNav}
            aria-label="Open navigation"
            className="rounded-xl p-2 text-ink-soft transition-colors duration-200 hover:bg-cream-200 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-ink shadow-soft ring-1 ring-cream-200">
            <span className="h-1.5 w-1.5 rounded-full bg-olive-500" />
            Admin
          </span>
        </div>

        <Button variant="secondary" size="sm" onClick={onLogout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}
