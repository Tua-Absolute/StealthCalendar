'use client';

import { useEffect, useState } from 'react';
import { addDays, addHours, startOfDay } from 'date-fns';
import { Trash2, X } from 'lucide-react';
import { toDateInput, toLocalInput } from '@/lib/calendar/dates';
import { useDeleteEvent, useSaveEvent } from '@/lib/data/hooks';
import type { CalendarRow, CategoryRow, EventRow } from '@/lib/data/types';
import { ColorPicker } from './ColorPicker';

/** What the dialog opens with: an existing event, or a new one at a time. */
export type Draft =
  | { kind: 'edit'; row: EventRow }
  | { kind: 'new'; start: Date; allDay: boolean };

interface FormState {
  title: string;
  calendarId: string;
  allDay: boolean;
  start: string;
  end: string;
  location: string;
  description: string;
  color: string | null;
  categoryId: string;
}

function initialState(draft: Draft, calendars: CalendarRow[]): FormState {
  if (draft.kind === 'edit') {
    const r = draft.row;
    const start = new Date(r.start_at);
    const end = new Date(r.end_at);
    return {
      title: r.title,
      calendarId: r.calendar_id,
      allDay: r.all_day,
      // All-day events end at midnight after their last day; show that last day.
      start: r.all_day ? toDateInput(start) : toLocalInput(start),
      end: r.all_day ? toDateInput(addDays(end, -1)) : toLocalInput(end),
      location: r.location ?? '',
      description: r.description ?? '',
      color: r.color,
      categoryId: r.category_id ?? '',
    };
  }
  const { start, allDay } = draft;
  return {
    title: '',
    calendarId: calendars.find((c) => c.source === 'local')?.id ?? calendars.find((c) => c.writable)?.id ?? '',
    allDay,
    start: allDay ? toDateInput(start) : toLocalInput(start),
    end: allDay ? toDateInput(start) : toLocalInput(addHours(start, 1)),
    location: '',
    description: '',
    color: null,
    categoryId: '',
  };
}

/** Parses `yyyy-MM-dd` as local midnight (Date parses it as UTC). */
function parseDateInput(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function EventDialog({ draft, calendars, categories, onClose }: {
  draft: Draft;
  calendars: CalendarRow[];
  categories: CategoryRow[];
  onClose: () => void;
}) {
  const [form, setForm] = useState(() => initialState(draft, calendars));
  const [error, setError] = useState<string | null>(null);
  const save = useSaveEvent();
  const remove = useDeleteEvent();
  // Events in a read-only calendar (a shared or holiday calendar) can be viewed but not changed.
  const readOnly = draft.kind === 'edit' && calendars.find((c) => c.id === draft.row.calendar_id)?.writable === false;
  const choices = calendars.filter((c) => c.writable || c.id === form.calendarId);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleAllDay = (allDay: boolean) => {
    const start = form.allDay ? parseDateInput(form.start) : new Date(form.start);
    const end = form.allDay ? parseDateInput(form.end) : new Date(form.end);
    setForm((f) => ({
      ...f,
      allDay,
      start: allDay ? toDateInput(start) : toLocalInput(addHours(startOfDay(start), 9)),
      end: allDay ? toDateInput(end) : toLocalInput(addHours(startOfDay(end), 10)),
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const start = form.allDay ? parseDateInput(form.start) : new Date(form.start);
    const end = form.allDay ? addDays(parseDateInput(form.end), 1) : new Date(form.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return setError('Enter a start and end.');
    if (end < start) return setError('The end must be after the start.');
    try {
      await save.mutateAsync({
        id: draft.kind === 'edit' ? draft.row.id : undefined,
        from_calendar_id: draft.kind === 'edit' ? draft.row.calendar_id : undefined,
        calendar_id: form.calendarId,
        title: form.title.trim() || '(No title)',
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        all_day: form.allDay,
        color: form.color,
        category_id: form.categoryId || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the event.');
    }
  };

  const del = async () => {
    if (draft.kind !== 'edit') return;
    try {
      await remove.mutateAsync(draft.row);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the event.');
    }
  };

  // With no color of its own, the event takes its category's color, then its calendar's.
  const inheritedColor = categories.find((c) => c.id === form.categoryId)?.color
    ?? calendars.find((c) => c.id === form.calendarId)?.color;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border-default bg-surface-elevated p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground-emphasis">
            {readOnly ? 'Event' : draft.kind === 'edit' ? 'Edit event' : 'New event'}
          </h2>
          <button type="button" onClick={onClose} className="icon-button" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <input
          autoFocus
          className="field text-base"
          placeholder="Add a title"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
        />

        <label className="flex items-center gap-2 text-sm text-foreground-default">
          <input type="checkbox" className="h-4 w-4 accent-red-600" checked={form.allDay}
            onChange={(e) => toggleAllDay(e.target.checked)} />
          All day
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Starts</label>
            <input type={form.allDay ? 'date' : 'datetime-local'} required className="field [color-scheme:dark]"
              value={form.start} onChange={(e) => set('start', e.target.value)} />
          </div>
          <div>
            <label className="label">Ends</label>
            <input type={form.allDay ? 'date' : 'datetime-local'} required className="field [color-scheme:dark]"
              value={form.end} onChange={(e) => set('end', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Calendar</label>
            <select className="field" value={form.calendarId} onChange={(e) => set('calendarId', e.target.value)}>
              {choices.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select className="field" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Color</label>
          <ColorPicker value={form.color} onChange={(c) => set('color', c)} allowNone noneColor={inheritedColor} />
        </div>

        <div>
          <label className="label">Location</label>
          <input className="field" value={form.location} onChange={(e) => set('location', e.target.value)} />
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea rows={3} className="field resize-y" value={form.description}
            onChange={(e) => set('description', e.target.value)} />
        </div>

        {readOnly && <p className="text-sm text-foreground-de-emphasis">This calendar is read-only, so this event can&apos;t be changed here.</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          {draft.kind === 'edit' && !readOnly ? (
            <button type="button" onClick={del} disabled={remove.isPending} className="btn text-red-400 hover:bg-red-500/10">
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={save.isPending || readOnly} className="btn-primary">
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
