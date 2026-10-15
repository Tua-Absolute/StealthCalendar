import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PROVIDERS, type Provider } from './types';

export function isProvider(p: string): p is Provider {
  return (PROVIDERS as string[]).includes(p);
}

/** The signed-in user's Supabase client, or a 401 response. */
export async function requireUser() {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Sign in first.' }, { status: 401 }) } as const;
  return { db, user } as const;
}

export function errorResponse(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : 'Something went wrong.';
  return NextResponse.json({ error: message }, { status });
}

export function redirectUri(origin: string, provider: Provider) {
  return `${origin}/api/connect/${provider}/callback`;
}
