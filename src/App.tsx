import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { HostDashboard } from '@/components/host/HostDashboard';
import { HostHome } from '@/components/HostHome';
import { ForgotPasswordPage } from '@/components/ForgotPasswordPage';
import { HostSignupPage } from '@/components/HostSignupPage';
import { LoginPage } from '@/components/LoginPage';
import { ResetPasswordPage } from '@/components/ResetPasswordPage';
import { VisitorPage } from '@/components/VisitorPage';
import { LatteMascotPrototype } from '@/components/dev/LatteMascotPrototype';
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

function App() {
  // Isolated dev prototype: /#latte-prototype — remove with the component file.
  if (window.location.hash === '#latte-prototype') {
    return <LatteMascotPrototype />;
  }
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryState>(() => readRecoveryState());
  const [showForgot, setShowForgot] = useState(
    () => (window.history.state as { screen?: string } | null)?.screen === 'forgot',
  );
  const [showSignup, setShowSignup] = useState(
    () => (window.history.state as { screen?: string } | null)?.screen === 'signup',
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

  if (resourceParams) {
    return <VisitorPage resourceId={resourceParams.resourceId} resourceType={resourceParams.resourceType} />;
  }

  if (portalId) {
    return <VisitorPage portalId={portalId} />;
  }

  if (recovery) {
    return (
      <ResetPasswordPage
        expired={recovery === 'error'}
        onDone={finishRecovery}
        onCancel={() => leaveRecovery(null)}
      />
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-100">
        <div className="flex items-center gap-3 text-sm text-ink-muted">
          <Loader2 className="h-5 w-5 animate-spin text-olive-600" />
          Loading…
        </div>
      </div>
    );
  }

  if (!session) {
    if (showSignup) {
      return <HostSignupPage onBack={backToLogin} />;
    }
    if (showForgot) {
      return <ForgotPasswordPage onBack={backToLogin} />;
    }

    return (
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
      />
    );
  }

  if (session.role === 'admin') {
    return <AdminDashboard onLogout={handleLogout} />;
  }

  if (session.role === 'host') {
    return <HostDashboard onLogout={handleLogout} />;
  }

  return <HostHome email={session.email} onLogout={handleLogout} />;
}

export default App;
