import { useEffect, useRef, useState, lazy, Suspense, Component, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { HostDashboard } from '@/components/host/HostDashboard';
import { HostHome } from '@/components/HostHome';
import { ForgotPasswordPage } from '@/components/ForgotPasswordPage';
import { HostSignupPage } from '@/components/HostSignupPage';
import { LoginPage } from '@/components/LoginPage';
import { ResetPasswordPage } from '@/components/ResetPasswordPage';
import { VisitorPage } from '@/components/VisitorPage';

const PresentationPage = lazy(() =>
  import('@/components/presentation/PresentationPage').then((m) => ({ default: m.PresentationPage })),
);
import {
  clearRecoveryHash,
  onAuthChange,
  readRecoveryState,
  resolveSession,
  signIn,
  signOut,
} from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { readPortalIdFromUrl, readVisitorParamsFromUrl } from '@/lib/links';
import type { Session } from '@/types';

type RecoveryState = 'recovery' | 'error' | null;

/**
 * App-level safety net: a render error inside any screen (e.g. the 3D viewer on a
 * device with flaky WebGL) must degrade to a message, never unmount the whole app
 * into a blank page.
 */
class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('Screen failed to render:', error);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream-100 px-6 text-center">
          <p className="max-w-sm text-sm text-ink-soft">
            Something went wrong while showing this page. Please go back and try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-olive-700 px-5 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-olive-800"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryState>(() => readRecoveryState());
  const [showForgot, setShowForgot] = useState(
    () => (window.history.state as { screen?: string } | null)?.screen === 'forgot',
  );
  const [showSignup, setShowSignup] = useState(
    () => (window.history.state as { screen?: string } | null)?.screen === 'signup',
  );
  const [showPresentation, setShowPresentation] = useState(
    () => (window.history.state as { screen?: string } | null)?.screen === 'presentation',
  );
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [portalId] = useState<string | null>(() => readPortalIdFromUrl());
  const [resourceParams] = useState(() => readVisitorParamsFromUrl());
  const signedOutRef = useRef(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const next = await resolveSession();
        if (active) setSession(next);
      } catch {
        if (active) setSession(null);
      } finally {
        if (active) setReady(true);
      }
    })();

    // A reset link lands on this page with a recovery token in the URL. The
    // client exchanges it for a short-lived session and raises this event, which
    // is what switches the screen to "choose a new password".
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && active) setRecovery('recovery');
    });

    const unsubscribe = onAuthChange((next) => {
      if (!active || signedOutRef.current) return;
      setSession(next);
      setReady(true);
    });

    // Sync React navigation state with browser back/forward. When the user
    // presses Back or Forward, read which screen that history entry represents
    // and update showSignup/showForgot accordingly.
    function handlePopState(event: PopStateEvent) {
      const screen = (event.state as { screen?: string } | null)?.screen;
      setShowSignup(screen === 'signup');
      setShowForgot(screen === 'forgot');
      setShowPresentation(screen === 'presentation');
    }
    window.addEventListener('popstate', handlePopState);

    return () => {
      active = false;
      unsubscribe();
      data.subscription.unsubscribe();
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Replace the current history entry once authenticated so pressing Back does
  // not resurrect a stale login/signup/forgot screen over the dashboard.
  useEffect(() => {
    if (session) {
      window.history.replaceState({ screen: 'authed' }, '');
    }
  }, [session]);

  function goToPresentation() {
    window.history.pushState({ screen: 'presentation' }, '');
    setShowPresentation(true);
    setLoginError(null);
    setLoginNotice(null);
  }

  function backFromPresentation() {
    window.history.back();
  }

  function goToSignup() {
    window.history.pushState({ screen: 'signup' }, '');
    setShowSignup(true);
    setShowForgot(false);
    setLoginError(null);
    setLoginNotice(null);
  }

  function goToForgot() {
    window.history.pushState({ screen: 'forgot' }, '');
    setShowForgot(true);
    setShowSignup(false);
    setLoginError(null);
    setLoginNotice(null);
  }

  function backToLogin() {
    window.history.back();
  }

  async function handleLogin(email: string, password: string) {
    signedOutRef.current = false;
    try {
      await signIn(email, password);
      setLoginError(null);
      setLoginNotice(null);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Unable to sign in.');
    }
  }

  async function handleLogout() {
    signedOutRef.current = true;
    setSession(null);
    setLoginError(null);
    setLoginNotice(null);
    setShowForgot(false);
    setShowSignup(false);
    window.history.replaceState({ screen: 'login' }, '');
    await signOut();
  }

  function leaveRecovery(notice: string | null) {
    clearRecoveryHash();
    setRecovery(null);
    setSession(null);
    setLoginNotice(notice);
    setLoginError(null);
    setShowForgot(false);
    setShowSignup(false);
    window.history.replaceState({ screen: 'login' }, '');
  }

  async function finishRecovery() {
    // The recovery link leaves the browser holding a short-lived session. Ending
    // it means the new password must actually be used, and keeps the message on
    // the sign-in screen truthful.
    await signOut();
    leaveRecovery('Your password was updated. Sign in with your new password.');
  }

  return (
    <AppErrorBoundary>
      {resourceParams ? (
        <VisitorPage resourceId={resourceParams.resourceId} resourceType={resourceParams.resourceType} />
      ) : portalId ? (
        <VisitorPage portalId={portalId} />
      ) : recovery ? (
        <ResetPasswordPage
          expired={recovery === 'error'}
          onDone={finishRecovery}
          onCancel={() => leaveRecovery(null)}
        />
      ) : !ready ? (
        <div className="flex min-h-screen items-center justify-center bg-cream-100">
          <div className="flex items-center gap-3 text-sm text-ink-muted">
            <Loader2 className="h-5 w-5 animate-spin text-olive-600" />
            Loading…
          </div>
        </div>
      ) : !session ? (
        showPresentation ? (
          <Suspense
            fallback={
              <div className="flex min-h-screen items-center justify-center bg-cream-100">
                <div className="flex items-center gap-3 text-sm text-ink-muted">
                  <Loader2 className="h-5 w-5 animate-spin text-olive-600" />
                  Loading…
                </div>
              </div>
            }
          >
            <PresentationPage onBack={backFromPresentation} onBecomeHost={goToSignup} />
          </Suspense>
        ) : showSignup ? (
          <HostSignupPage onBack={backToLogin} />
        ) : showForgot ? (
          <ForgotPasswordPage onBack={backToLogin} />
        ) : (
          <LoginPage
            onSubmit={handleLogin}
            error={loginError}
            notice={loginNotice}
            clearError={() => {
              setLoginError(null);
              setLoginNotice(null);
            }}
            onForgotPassword={goToForgot}
            onBecomeHost={goToSignup}
            onOpenPresentation={goToPresentation}
          />
        )
      ) : session.role === 'admin' ? (
        <AdminDashboard onLogout={handleLogout} />
      ) : session.role === 'host' ? (
        <HostDashboard onLogout={handleLogout} />
      ) : (
        <HostHome email={session.email} onLogout={handleLogout} />
      )}
    </AppErrorBoundary>
  );
}

export default App;
