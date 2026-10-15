import { NextResponse, type NextRequest } from 'next/server';
import { adapters, syncAll, zoneOr } from '@/lib/sync';
import { createAdminClient } from '@/lib/supabase/admin';
import { isProvider, redirectUri, requireUser } from '@/lib/sync/route-helpers';
import { PALETTE } from '@/lib/data/types';

export const maxDuration = 60;

export async function GET(request: NextRequest, { params }: { params: { provider: string } }) {
  const { provider } = params;
  const origin = request.nextUrl.origin;
  const fail = (message: string) => {
    const res = NextResponse.redirect(`${origin}/?connect_error=${encodeURIComponent(message)}`);
    res.cookies.delete({ name: 'oauth_state', path: '/api/connect' });
    return res;
  };
  if (!isProvider(provider)) return fail('Unknown calendar provider.');

  const q = request.nextUrl.searchParams;
  if (q.get('error')) return fail(q.get('error_description') ?? 'Sign-in was cancelled.');
  const expected = request.cookies.get('oauth_state')?.value;
  if (!expected || expected !== `${provider}:${q.get('state')}`) return fail('Sign-in expired. Try connecting again.');
  const code = q.get('code');
  if (!code) return fail('The provider did not return a sign-in code.');

  const auth = await requireUser();
  if ('error' in auth) return NextResponse.redirect(`${origin}/login`);
  const { db } = auth;
  const tz = zoneOr(request.cookies.get('oauth_tz')?.value, 'UTC');

  try {
    const adapter = adapters[provider];
    const tokens = await adapter.exchangeCode(code, redirectUri(origin, provider));

    const { data: account, error } = await db
      .from('accounts')
      .upsert({ provider, email: tokens.email, timezone: tz }, { onConflict: 'user_id,provider,email' })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    const { error: tokenError } = await createAdminClient().from('account_tokens').upsert({
      account_id: account.id,
      refresh_token: tokens.refreshToken,
      access_token: tokens.accessToken,
      expires_at: tokens.expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (tokenError) throw new Error(tokenError.message);

    // New calendars only: a reconnect keeps the colors and visibility already chosen.
    const remote = await adapter.listCalendars(tokens.accessToken);
    const { count } = await db.from('calendars').select('id', { count: 'exact', head: true });
    const { error: calError } = await db.from('calendars').upsert(
      remote.map((c, i) => ({
        account_id: account.id,
        external_id: c.id,
        name: c.primary ? (provider === 'google' ? 'Google Calendar' : 'Outlook Calendar') : c.name,
        color: c.color && /^#[0-9a-f]{6}$/i.test(c.color) ? c.color.toLowerCase() : PALETTE[((count ?? 0) + i) % PALETTE.length],
        source: provider,
        writable: c.writable,
        // Start with the main calendar showing; holidays, birthdays and shared ones can be switched on.
        visible: c.primary,
      })),
      { onConflict: 'account_id,external_id', ignoreDuplicates: true }
    );
    if (calError) throw new Error(calError.message);

    await syncAll(db, tz);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not connect the account.');
  }

  const res = NextResponse.redirect(`${origin}/?connected=${provider}`);
  res.cookies.delete({ name: 'oauth_state', path: '/api/connect' });
  res.cookies.delete({ name: 'oauth_tz', path: '/api/connect' });
  return res;
}
