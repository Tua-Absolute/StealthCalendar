import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { adapters } from '@/lib/sync';
import { isProvider, redirectUri, requireUser } from '@/lib/sync/route-helpers';

// Starts the sign-in with Google or Microsoft. The state cookie ties the callback to this browser.
export async function GET(request: NextRequest, { params }: { params: { provider: string } }) {
  const { provider } = params;
  const origin = request.nextUrl.origin;
  if (!isProvider(provider)) return NextResponse.redirect(`${origin}/`);
  const auth = await requireUser();
  if ('error' in auth) return NextResponse.redirect(`${origin}/login`);

  let url: string;
  try {
    url = adapters[provider].authUrl(redirectUri(origin, provider), '');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not start sign-in.';
    return NextResponse.redirect(`${origin}/?connect_error=${encodeURIComponent(message)}`);
  }
  const state = randomUUID();
  const authUrl = new URL(url);
  authUrl.searchParams.set('state', state);

  const res = NextResponse.redirect(authUrl.toString());
  const cookie = { httpOnly: true, secure: origin.startsWith('https'), sameSite: 'lax' as const, maxAge: 600, path: '/api/connect' };
  res.cookies.set('oauth_state', `${provider}:${state}`, cookie);
  res.cookies.set('oauth_tz', request.nextUrl.searchParams.get('tz') ?? '', cookie);
  return res;
}
