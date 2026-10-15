'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Range } from '@/lib/calendar/dates';
import type { ImportedEvent } from '@/lib/import';
import { PALETTE, isRemote, type AccountRow, type CalendarRow, type CategoryRow, type EventInput, type EventRow } from './types';

const supabase = createClient();

export const keys = {
  calendars: ['calendars'] as const,
  categories: ['categories'] as const,
  accounts: ['accounts'] as const,
  events: (range: Range) => ['events', range.start.toISOString(), range.end.toISOString()] as const,
};

export function useCalendars() {
  return useQuery({
    queryKey: keys.calendars,
    queryFn: async (): Promise<CalendarRow[]> => {
      const { data, error } = await supabase.from('calendars').select('*').order('created_at');
      if (error) throw error;
      if (data.length > 0) return data;
      // First visit: give the user a calendar to put events in.
      const { data: created, error: insertError } = await supabase
        .from('calendars')
        .insert({ name: 'Personal', color: '#ef4444' })
        .select();
      if (insertError) throw insertError;
      return created;
    },
  });
}

export function useEvents(range: Range) {
  return useQuery({
    queryKey: keys.events(range),
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .lt('start_at', range.end.toISOString())
        .gte('end_at', range.start.toISOString())
        .order('start_at');
      if (error) throw error;
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

async function api(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data;
}

export function useSaveEvent() {
  const qc = useQueryClient();
  return useMutation({
    /** `from_calendar_id` is the event's calendar before this edit, so moves out of Google or Outlook are handled. */
    mutationFn: async ({ from_calendar_id, ...input }: EventInput & { from_calendar_id?: string }) => {
      const cals = qc.getQueryData<CalendarRow[]>(keys.calendars) ?? [];
      const touchesRemote = [input.calendar_id, from_calendar_id].some((id) => isRemote(cals.find((c) => c.id === id)));
      if (touchesRemote) {
        await api(input.id ? 'PATCH' : 'POST', '/api/events', { ...input, tz: timeZone() });
        return;
      }
      const { id, ...fields } = input;
      const query = id
        ? supabase.from('events').update(fields).eq('id', id)
        : supabase.from('events').insert(fields);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Pick<EventRow, 'id' | 'calendar_id'>) => {
      const cals = qc.getQueryData<CalendarRow[]>(keys.calendars) ?? [];
      if (isRemote(cals.find((c) => c.id === row.calendar_id))) {
        await api('DELETE', `/api/events?id=${encodeURIComponent(row.id)}`);
        return;
      }
      const { error } = await supabase.from('events').delete().eq('id', row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: keys.accounts,
    queryFn: async (): Promise<AccountRow[]> => {
      const { data, error } = await supabase.from('accounts').select('id, provider, email, created_at').order('created_at');
      if (error) throw error;
      return data as AccountRow[];
    },
  });
}

export function useDisconnectAccount() {
  const qc = useQueryClient();
  return useMutation({
    // Deleting the account removes its calendars, their events and its saved sign-in.
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.accounts });
      qc.invalidateQueries({ queryKey: keys.calendars });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export interface SyncSummary {
  calendars: number;
  events: number;
  removed: number;
  errors: string[];
}

export function useSyncNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['sync'],
    mutationFn: (): Promise<SyncSummary> => api('POST', '/api/sync', { tz: timeZone() }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.calendars });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

const AUTO_SYNC_MS = 5 * 60 * 1000;

/** While the app is open: sync on load, every five minutes, and when the tab comes back into view. */
export function useAutoSync(enabled: boolean) {
  const sync = useSyncNow();
  const last = useRef(0);
  const run = useRef(sync.mutate);
  run.current = sync.mutate;

  useEffect(() => {
    if (!enabled) return;
    const maybeSync = (minGap: number) => {
      if (Date.now() - last.current < minGap) return;
      last.current = Date.now();
      run.current();
    };
    maybeSync(0);
    const timer = setInterval(() => maybeSync(AUTO_SYNC_MS - 1000), AUTO_SYNC_MS);
    const onVisible = () => document.visibilityState === 'visible' && maybeSync(60_000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);

  return sync;
}

export function useSaveCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cal: Partial<CalendarRow> & { name?: string }) => {
      const { id, ...fields } = cal;
      const query = id
        ? supabase.from('calendars').update(fields).eq('id', id)
        : supabase.from('calendars').insert(fields);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.calendars });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useDeleteCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendars').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.calendars });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: Partial<CategoryRow>) => {
      const { id, ...fields } = cat;
      const query = id
        ? supabase.from('categories').update(fields).eq('id', id)
        : supabase.from('categories').insert(fields);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.categories });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export type ImportTarget =
  | { kind: 'new'; name: string; color: string }
  | { kind: 'existing'; calendarId: string };

export interface ImportResult {
  calendarId: string;
  added: number;
  updated: number;
}

const CHUNK = 500;

/**
 * Saves parsed events into a calendar. Events are matched on their source UID, so importing
 * the same file again updates those events instead of duplicating them.
 */
export function useImportEvents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ events, target }: { events: ImportedEvent[]; target: ImportTarget }): Promise<ImportResult> => {
      let calendarId: string;
      if (target.kind === 'new') {
        const { data, error } = await supabase
          .from('calendars')
          .insert({ name: target.name, color: target.color, source: 'ics' })
          .select('id')
          .single();
        if (error) throw error;
        calendarId = data.id;
      } else {
        calendarId = target.calendarId;
      }

      // Categories named in the file: create the missing ones, then map names to ids.
      const names = Array.from(new Set(events.map((e) => e.category).filter((c): c is string => !!c)));
      const categoryIds = new Map<string, string>();
      if (names.length) {
        const { data: existing, error } = await supabase.from('categories').select('id, name');
        if (error) throw error;
        existing.forEach((c) => categoryIds.set(c.name.toLowerCase(), c.id));
        const missing = names.filter((n) => !categoryIds.has(n.toLowerCase()));
        if (missing.length) {
          const { data: created, error: insertError } = await supabase
            .from('categories')
            .insert(missing.map((name, i) => ({ name, color: PALETTE[(existing.length + i) % PALETTE.length] })))
            .select('id, name');
          if (insertError) throw insertError;
          created.forEach((c) => categoryIds.set(c.name.toLowerCase(), c.id));
        }
      }

      const existingUids = new Set<string>();
      if (target.kind === 'existing') {
        const { data, error } = await supabase.from('events').select('uid').eq('calendar_id', calendarId).not('uid', 'is', null);
        if (error) throw error;
        data.forEach((r) => existingUids.add(r.uid as string));
      }

      // The same UID can appear twice in a sloppy file; keep the last one.
      const unique = new Map(events.map((e) => [e.uid, e]));
      const rows = Array.from(unique.values()).map((e) => ({
        calendar_id: calendarId,
        uid: e.uid,
        title: e.title,
        description: e.description,
        location: e.location,
        start_at: e.start.toISOString(),
        end_at: e.end.toISOString(),
        all_day: e.allDay,
        category_id: e.category ? categoryIds.get(e.category.toLowerCase()) ?? null : null,
      }));
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await supabase.from('events').upsert(rows.slice(i, i + CHUNK), { onConflict: 'calendar_id,uid' });
        if (error) throw error;
      }

      const updated = rows.filter((r) => existingUids.has(r.uid)).length;
      return { calendarId, added: rows.length - updated, updated };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.calendars });
      qc.invalidateQueries({ queryKey: keys.categories });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

/** Characters with meaning in PostgREST filter strings. */
function sanitizeSearch(term: string) {
  return term.replace(/[,()*%\\:]/g, ' ').trim();
}

export function useSearchEvents(term: string) {
  const q = sanitizeSearch(term);
  return useQuery({
    queryKey: ['search', q],
    enabled: q.length >= 2,
    queryFn: async (): Promise<EventRow[]> => {
      const pattern = `*${q}*`;
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .or(`title.ilike.${pattern},location.ilike.${pattern},description.ilike.${pattern}`)
        .order('start_at', { ascending: false })
        .limit(25);
      if (error) throw error;
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

/** An event joined with what the views need to draw it. */
export interface CalendarItem {
  id: string;
  start: Date;
  end: Date;
  allDay: boolean;
  title: string;
  color: string;
  row: EventRow;
}

export function useCalendarItems(range: Range) {
  const calendars = useCalendars();
  const categories = useCategories();
  const events = useEvents(range);
  const items = useMemo(() => {
    const byId = new Map((calendars.data ?? []).map((c) => [c.id, c]));
    const catById = new Map((categories.data ?? []).map((c) => [c.id, c]));
    return (events.data ?? []).flatMap((row): CalendarItem[] => {
      const cal = byId.get(row.calendar_id);
      if (!cal || !cal.visible) return [];
      const cat = row.category_id ? catById.get(row.category_id) : undefined;
      if (cat && !cat.visible) return [];
      return [
        {
          id: row.id,
          start: new Date(row.start_at),
          end: new Date(row.end_at),
          allDay: row.all_day,
          title: row.title,
          // An event's own color wins, then its category's, then its calendar's.
          color: row.color ?? cat?.color ?? cal.color,
          row,
        },
      ];
    });
  }, [calendars.data, categories.data, events.data]);
  return { items, calendars, categories, events };
}
