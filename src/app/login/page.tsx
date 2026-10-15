'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';

const ERRORS: Record<string, string> = {
  'not-allowed': 'That account is not allowed to use this calendar.',
  'confirm-failed': 'That confirmation link expired. Sign in, or sign up again for a new link.',
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(ERRORS[params.get('error') ?? ''] ?? null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else {
        router.replace('/');
        router.refresh();
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setMessage(error.message);
      else if (data.session) {
        router.replace('/');
        router.refresh();
      } else setMessage('Check your email for a confirmation link, then sign in.');
    }
    setBusy(false);
  };

  return (
    <Card className="w-full max-w-sm">
      <div className="flex items-center gap-2 mb-6">
        <CalendarDays className="h-7 w-7 text-red-500" />
        <h1 className="text-xl font-semibold text-foreground-emphasis">
          Stealth<span className="text-red-500">Calendar</span>
        </h1>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" className="field"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" required minLength={8}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} className="field"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {message && <p className="text-sm text-red-400">{message}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <button
        type="button"
        onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(null); }}
        className="mt-4 w-full text-center text-sm text-foreground-de-emphasis hover:text-foreground-emphasis"
      >
        {mode === 'signin' ? 'First time here? Create your account' : 'Already have an account? Sign in'}
      </button>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
