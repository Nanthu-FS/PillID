'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '@/lib/supabaseClient';

const SessionContext = createContext<Session | null>(null);

/** The signed-in user's id. Only call inside <AuthGate> (i.e. any page). */
export function useUserId(): string {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useUserId must be used inside AuthGate');
  return session.user.id;
}

/** Renders the app for a signed-in user, and the sign-in form otherwise. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!supabaseConfigured) {
    return (
      <div role="alert" className="card border-major-ring bg-major-bg p-5 text-major-fg">
        <p className="font-medium">PillID isn’t configured</p>
        <p className="mt-1 text-sm">
          Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then redeploy.
        </p>
      </div>
    );
  }
  if (loading) return <div className="skeleton h-40 w-full" aria-busy="true" />;
  if (!session) return <SignIn />;

  return (
    <SessionContext.Provider value={session}>
      {children}
      <p className="mt-8 text-center text-xs text-ink-faint">
        Signed in as {session.user.email}.{' '}
        <button
          className="font-medium text-sage-700 underline underline-offset-2 hover:text-sage-800"
          onClick={() => void supabase.auth.signOut()}
        >
          Sign out
        </button>
      </p>
    </SessionContext.Provider>
  );
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setError(error.message);
      setStatus('idle');
    } else {
      setStatus('sent');
    }
  }

  return (
    <div className="card mx-auto max-w-md space-y-4 p-6">
      <div className="space-y-1">
        <p className="eyebrow">Your private cabinet</p>
        <h1 className="text-2xl font-semibold">Sign in to PillID</h1>
        <p className="text-sm text-ink-soft">
          We’ll email you a sign-in link. Your medications and photos are visible only to you.
        </p>
      </div>

      {status === 'sent' ? (
        <div role="status" className="rounded-xl bg-sage-50 p-4 text-sage-800">
          <p className="font-medium">Check your email</p>
          <p className="mt-1 text-sm">
            We sent a sign-in link to {email.trim()}. Open it on this device.
          </p>
          <button className="btn-ghost mt-2 px-3 py-2 text-sm" onClick={() => setStatus('idle')}>
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-major-fg">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary w-full" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
          </button>
        </form>
      )}
    </div>
  );
}
