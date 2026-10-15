import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { accessTokenFor, adapters, eventRow, zoneOr, type AccountRow } from '@/lib/sync';
import type { EventWrite } from '@/lib/sync/types';
import { errorResponse, requireUser } from '@/lib/sync/route-helpers';

/**
 * Creates, updates and deletes events when a Google or Outlook calendar is involved.
 * The provider is written first, so the app never shows a change the provider rejected.
 */

interface CalendarInfo {
  id: string;
  external_id: string | null;
  writable: boolean;
  account: AccountRow | null;
}

interface Body {
  id?: string;
  calendar_id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color?: string | null;
  category_id?: string | null;
  tz?: string;
}

async function loadCalendar(db: SupabaseClient, id: string): Promise<CalendarInfo> {
  const { data, error } = await db
    .from('calendars')
    .select('id, external_id, writable, account:accounts(id, user_id, provider, email, timezone)')
    .eq('id', id)
    .single();
  if (error || !data) throw new Error('Calendar not found.');
  const account = (Array.isArray(data.account) ? data.account[0] : data.account) as AccountRow | null;
  return { id: data.id, external_id: data.external_id, writable: data.writable, account };
}

async function remoteDelete(cal: CalendarInfo, uid: string | null) {
  if (!cal.account || !uid) return;
  const token = await accessTokenFor(cal.account);
  await adapters[cal.account.provider].deleteEvent(token, cal.external_id!, uid);
}

export async function POST(request: Request) {
  return save(request);
}

export async function PATCH(request: Request) {
  return save(request);
}

async function save(request: Request) {
  const auth = await requireUser();
  if ('error' in auth) return auth.error;
  const { db } = auth;
  try {
    const body = (await request.json()) as Body;
    const target = await loadCalendar(db, body.calendar_id);
    if (!target.writable) return errorResponse(new Error('That calendar is read-only.'), 400);

    const existing = body.id
      ? (await db.from('events').select('id, calendar_id, uid').eq('id', body.id).single()).data
      : null;
    if (body.id && !existing) return errorResponse(new Error('Event not found.'), 404);
    const source = existing ? await loadCalendar(db, existing.calendar_id) : null;
    const sameCalendar = !!existing && existing.calendar_id === target.id;

    const local = { color: body.color ?? null, category_id: body.category_id ?? null };
    const write: EventWrite = {
      title: body.title,
      description: body.description ?? null,
      location: body.location ?? null,
      start: new Date(body.start_at),
      end: new Date(body.end_at),
      allDay: body.all_day,
    };

    if (target.account) {
      const tz = zoneOr(body.tz, target.account.timezone);
      const token = await accessTokenFor(target.account);
      const adapter = adapters[target.account.provider];
      const remote = sameCalendar && existing!.uid
        ? await adapter.updateEvent(token, target.external_id!, existing!.uid, write, tz)
        : await adapter.createEvent(token, target.external_id!, write, tz);
      const row = { ...eventRow(target.id, remote), ...local };
      if (sameCalendar) {
        const { error } = await db.from('events').update(row).eq('id', existing!.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await db.from('events').upsert(row, { onConflict: 'calendar_id,uid' });
        if (error) throw new Error(error.message);
      }
    } else {
      const row = {
        calendar_id: target.id,
        title: write.title,
        description: write.description,
        location: write.location,
        start_at: body.start_at,
        end_at: body.end_at,
        all_day: write.allDay,
        ...local,
      };
      const { error } = sameCalendar
        ? await db.from('events').update(row).eq('id', existing!.id)
        : await db.from('events').insert(row);
      if (error) throw new Error(error.message);
    }

    // Moved to another calendar: remove it from where it was.
    if (existing && !sameCalendar) {
      await remoteDelete(source!, existing.uid);
      const { error } = await db.from('events').delete().eq('id', existing.id);
      if (error) throw new Error(error.message);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if ('error' in auth) return auth.error;
  const { db } = auth;
  try {
    const id = new URL(request.url).searchParams.get('id');
    const { data: existing } = await db.from('events').select('id, calendar_id, uid').eq('id', id).single();
    if (!existing) return errorResponse(new Error('Event not found.'), 404);
    const cal = await loadCalendar(db, existing.calendar_id);
    if (cal.account && !cal.writable) return errorResponse(new Error('That calendar is read-only.'), 400);
    await remoteDelete(cal, existing.uid);
    const { error } = await db.from('events').delete().eq('id', existing.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
