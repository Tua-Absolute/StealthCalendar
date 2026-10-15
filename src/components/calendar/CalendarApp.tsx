'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ListFilter, Plus } from 'lucide-react';
import { setHours, startOfHour, addHours } from 'date-fns';
import { Header } from '@/components/layout/Header';
import { getRange, rangeTitle, shiftCursor, type View } from '@/lib/calendar/dates';
import { useCalendarItems, type CalendarItem } from '@/lib/data/hooks';
import { useViewStore } from '@/store/view';
import { cn } from '@/lib/utils';
import { CalendarList } from './CalendarList';
import { EventDialog, type Draft } from './EventDialog';
import { MonthView } from './MonthView';
import { TimeGridView } from './TimeGridView';

const VIEWS: View[] = ['month', 'week', 'day'];

export function CalendarApp() {
  const { view, cursor, setView, setCursor } = useViewStore();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showCalendars, setShowCalendars] = useState(false);
  const range = useMemo(() => getRange(view, cursor), [view, cursor]);
  const { items, calendars, events } = useCalendarItems(range);

  const openDay = (day: Date) => { setCursor(day); setView('day'); };
  const select = (item: CalendarItem) => setDraft({ kind: 'edit', row: item.row });
  const create = (start: Date, allDay = false) => setDraft({ kind: 'new', start, allDay });

  // Keyboard shortcuts, like Google Calendar: t, m, w, d, arrows, n.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (draft || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const map: Record<string, () => void> = {
        t: () => setCursor(new Date()),
        m: () => setView('month'),
        w: () => setView('week'),
        d: () => setView('day'),
        n: () => setDraft({ kind: 'new', start: startOfHour(addHours(new Date(), 1)), allDay: false }),
        ArrowLeft: () => setCursor(shiftCursor(view, cursor, -1)),
        ArrowRight: () => setCursor(shiftCursor(view, cursor, 1)),
      };
      map[e.key]?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft, view, cursor, setCursor, setView]);

  const error = calendars.error ?? events.error;

  return (
    <div className="flex h-[100dvh] flex-col">
      <Header>
        <button type="button" onClick={() => setShowCalendars((s) => !s)} className="icon-button lg:hidden" aria-label="Calendars">
          <ListFilter className="h-5 w-5" />
        </button>
      </Header>

      <div className="flex min-h-0 flex-1">
        <aside className={cn(
          'w-64 flex-shrink-0 border-r border-border-default bg-surface p-4 space-y-6 overflow-y-auto',
          showCalendars ? 'fixed inset-y-16 left-0 z-30 block' : 'hidden lg:block'
        )}>
          <button
            type="button"
            onClick={() => create(startOfHour(addHours(new Date(), 1)))}
            className="btn-primary w-full"
          >
            <Plus className="h-4 w-4" /> New event
          </button>
          {calendars.data && <CalendarList calendars={calendars.data} />}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col p-3 sm:p-4 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setCursor(new Date())} className="btn-ghost">Today</button>
            <div className="flex">
              <button type="button" onClick={() => setCursor(shiftCursor(view, cursor, -1))} className="icon-button" aria-label="Previous">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => setCursor(shiftCursor(view, cursor, 1))} className="icon-button" aria-label="Next">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <h2 className="order-first w-full sm:order-none sm:w-auto sm:flex-1 min-w-0 truncate text-lg sm:text-xl font-semibold text-foreground-emphasis">
              {rangeTitle(view, cursor)}
            </h2>
            <div className="ml-auto flex rounded-xl border border-border-default p-0.5">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                    view === v ? 'bg-red-500/10 text-red-400' : 'text-gray-400 hover:text-foreground-emphasis'
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              Could not load your calendar: {error.message}
            </p>
          )}

          <div className="min-h-0 flex-1 overflow-auto">
            {view === 'month' ? (
              <MonthView range={range} cursor={cursor} items={items} onSelect={select}
                onCreate={(d) => create(setHours(d, 9))} onOpenDay={openDay} />
            ) : (
              <TimeGridView key={view} range={range} items={items} onSelect={select} onCreate={create} onOpenDay={openDay} />
            )}
          </div>
        </main>
      </div>

      <button
        type="button"
        onClick={() => create(startOfHour(addHours(new Date(), 1)))}
        className="lg:hidden fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-900/40 hover:bg-red-500"
        aria-label="New event"
      >
        <Plus className="h-6 w-6" />
      </button>

      {draft && calendars.data && (
        <EventDialog draft={draft} calendars={calendars.data} onClose={() => setDraft(null)} />
      )}
    </div>
  );
}
