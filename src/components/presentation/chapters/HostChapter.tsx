import { Mail, Building2, KeyRound, LayoutDashboard } from 'lucide-react';
import { ChapterShell, ChapterText, ChapterVisual } from '../ChapterShell';

const STEPS = [
  { icon: KeyRound, title: 'Create your Host account', text: 'Sign up with your email and a password — the "Become a Host" button on the login page starts it.' },
  { icon: Mail, title: 'Confirm your email', text: 'A verification email makes sure the account is yours before anything goes live.' },
  { icon: Building2, title: 'Your restaurant is created', text: 'Registration sets up your restaurant environment on the platform in the same step.' },
  { icon: LayoutDashboard, title: 'Sign in to your Host Dashboard', text: 'Your dashboard is the control room for menus, departments, orders and settings.' },
];

export function HostChapter() {
  return (
    <ChapterShell
      id="chapter-host"
      chapterNumber={2}
      kicker="Become a Host"
      title="From sign-up to a running restaurant in four steps."
      flip
    >
      <ChapterText>
        <ol className="mt-2 space-y-4">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="flex gap-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200/80">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-olive-50 text-olive-700">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">
                  <span className="mr-2 text-olive-600">{index + 1}.</span>
                  {title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </ChapterText>
      <ChapterVisual src="/host-account.webp" alt="A restaurant identity forming from a digital account" />
    </ChapterShell>
  );
}
