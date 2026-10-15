import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { google } from './google';
import { outlook } from './outlook';
import { syncWindow, type EventWrite, type Provider, type ProviderAdapter, type RemoteEvent } from './types';
import { isValidZone } from './tz';

export const adapters: Record<Provider, ProviderAdapter> = { google, outlook };

export interface AccountRow {
  id: string;
  user_id: string;
  provider: Provider;
  email: string;
  timezone: string;
}

export interface RemoteCalendarRow {
  id: string;
  account_id: string;
  external_id: string;
  name: string;
  writable: boolean;
}

/** A refreshed access token for an account, cached in the database until a minute before it expires. */
export async function accessTokenFor(account: AccountRow): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('account_tokens')
    .select('refresh_token, access_token, expires_at')
    .eq('account_id', account.id)
    .single();
  if (error || !data) throw new Error(`No saved sign-in for ${account.email}. Connect the account again.`);
  if (data.access_token && data.expires_at && new Date(data.expires_at).getTime() > Date.now() + 60_000) {
    return data.access_token;
  }
  let t;
  try {
    t = await adapters[account.provider].refresh(data.refresh_token);
  } catch (err) {
    // A revoked or expired refresh token: only signing in again fixes it.
    const status = (err as { status?: number }).status;
    if (status === 400 || status === 401) {
      throw new Error(`The sign-in for ${account.email} has expired. Disconnect it and connect it again.`);
    }
    throw err;
  }
  await admin
    .from('account_tokens')
    .update({
      access_token: t.accessToken,
      expires_at: t.expiresAt.toISOString(),
      ...(t.refreshToken ? { refresh_token: t.refreshToken } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('account_id', account.id);
  return t.accessToken;
}

export function zoneOr(tz: unknown, fallback: string) {
  return typeof tz === 'string' && isValidZone(tz) ? tz : fallback;
}

export function eventRow(calendarId: string, e: RemoteEvent) {
  return {
    calendar_id: calendarId,
    uid: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    start_at: e.start.toISOString(),
    end_at: e.end.toISOString(),
    all_day: e.allDay,
  };
}

const CHUNK = 500;

/**
 * Mirrors one provider calendar into the events table for the sync window: upserts what the provider
 * has and removes what it no longer has. Local-only fields (category, color override) are left alone.
 */
export async function syncCalendar(db: SupabaseClient, account: AccountRow, cal: RemoteCalendarRow, token: string, tz: string) {
  const window = syncWindow();
  const remote = await adapters[account.provider].listEvents(token, cal.external_id, window, tz);

  const rows = remote.map((e) => eventRow(cal.id, e));
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from('events').upsert(rows.slice(i, i + CHUNK), { onConflict: 'calendar_id,uid' });
    if (error) throw new Error(error.message);
  }

  const { data: existing, error } = await db
    .from('events')
    .select('id, uid')
    .eq('calendar_id', cal.id)
    .lt('start_at', window.end.toISOString())
    .gt('end_at', window.start.toISOString());
  if (error) throw new Error(error.message);
  const keep = new Set(remote.map((e) => e.id));
  const stale = existing.filter((r) => !r.uid || !keep.has(r.uid)).map((r) => r.id);
  for (let i = 0; i < stale.length; i += 100) {
    const { error: delError } = await db.from('events').delete().in('id', stale.slice(i, i + 100));
    if (delError) throw new Error(delError.message);
  }
  return { upserted: rows.length, removed: stale.length };
}

export interface SyncSummary {
  calendars: number;
  events: number;
  removed: number;
  errors: string[];
}

/** Syncs every visible calendar of every connected account the signed-in user has. */
export async function syncAll(db: SupabaseClient, tz?: string): Promise<SyncSummary> {
  const summary: SyncSummary = { calendars: 0, events: 0, removed: 0, errors: [] };
  const { data: accounts, error } = await db.from('accounts').select('id, user_id, provider, email, timezone');
  if (error) throw new Error(error.message);

  for (const account of accounts as AccountRow[]) {
    const zone = zoneOr(tz, account.timezone);
    if (zone !== account.timezone) await db.from('accounts').update({ timezone: zone }).eq('id', account.id);

    const { data: cals, error: calError } = await db
      .from('calendars')
      .select('id, account_id, external_id, name, writable')
      .eq('account_id', account.id)
      .eq('visible', true);
    if (calError) throw new Error(calError.message);

    let token: string;
    try {
      token = await accessTokenFor(account);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push(`${account.email}: ${message}`);
      await db.from('calendars').update({ sync_error: message }).eq('account_id', account.id);
      continue;
    }

    for (const cal of cals as RemoteCalendarRow[]) {
      try {
        const r = await syncCalendar(db, account, cal, token, zone);
        summary.calendars++;
        summary.events += r.upserted;
        summary.removed += r.removed;
        await db.from('calendars').update({ last_synced_at: new Date().toISOString(), sync_error: null }).eq('id', cal.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        summary.errors.push(`${cal.name}: ${message}`);
        await db.from('calendars').update({ sync_error: message }).eq('id', cal.id);
      }
    }
  }
  return summary;
}

export type { EventWrite };
