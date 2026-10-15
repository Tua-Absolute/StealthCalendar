'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Range } from '@/lib/calendar/dates';
import type { CalendarRow, EventInput, EventRow } from './types';

const supabase = createClient();

export const keys = {
  calendars: ['calendars'] as const,
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

export function useSaveEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...fields }: EventInput) => {
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
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
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
  const events = useEvents(range);
  const items = useMemo(() => {
    const byId = new Map((calendars.data ?? []).map((c) => [c.id, c]));
    return (events.data ?? []).flatMap((row): CalendarItem[] => {
      const cal = byId.get(row.calendar_id);
      if (!cal || !cal.visible) return [];
      return [
        {
          id: row.id,
          start: new Date(row.start_at),
          end: new Date(row.end_at),
          allDay: row.all_day,
          title: row.title,
          color: row.color ?? cal.color,
          row,
        },
      ];
    });
  }, [calendars.data, events.data]);
  return { items, calendars, events };
}
