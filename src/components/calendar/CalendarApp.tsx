'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileUp, ListFilter, Plus } from 'lucide-react';
import { setHours, startOfHour, addHours } from 'date-fns';
import { Header } from '@/components/layout/Header';
import { getRange, rangeTitle, shiftCursor, type View } from '@/lib/calendar/dates';
import { useCalendarItems, type CalendarItem } from '@/lib/data/hooks';
import type { EventRow } from '@/lib/data/types';
import { ACCEPTED, canImport, parseFile, type ParsedFile } from '@/lib/import';
import { useViewStore } from '@/store/view';
import { cn } from '@/lib/utils';
import { CalendarList } from './CalendarList';
import { CategoryList } from './CategoryList';
import { ImportDialog } from './ImportDialog';
import { SearchBox } from './SearchBox';
import { EventDialog, type Draft } from './EventDialog';
import { MonthView } from './MonthView';
import { TimeGridView } from './TimeGridView';

const VIEWS: View[] = ['month', 'week', 'day'];

export function CalendarApp() {
  const { view, cursor, setView, setCursor } = useViewStore();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showCalendars, setShowCalendars] = useState(false);
  const range = useMemo(() => getRange(view, cursor), [view, cursor]);
  const { items, calendars, categories, events } = useCalendarItems(range);
  const [imports, setImports] = useState<ParsedFile[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const readFiles = async (files: File[]) => {
    setImportError(null);
    const errors: string[] = [];
    const parsed: ParsedFile[] = [];
    for (const file of files) {
      if (!canImport(file)) {
        errors.push(`${file.name} isn't a calendar file. Drop .ics or .csv files.`);
        continue;
      }
      try {
        parsed.push(await parseFile(file));
      } catch (err) {
        errors.push(`Couldn't read ${file.name}: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }
    if (errors.length) setImportError(errors.join(' '));
    if (parsed.length) setImports((q) => [...q, ...parsed]);
  };

  // Drop files anywhere on the page to import them.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const onEnter = (e: DragEvent) => { if (hasFiles(e)) { depth++; setDragging(true); } };
    const onLeave = (e: DragEvent) => { if (hasFiles(e) && --depth <= 0) { depth = 0; setDragging(false); } };
    const onOver = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      readFiles(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const openFromSearch = (row: EventRow) => {
    setCursor(new Date(row.start_at));
    setView('day');
    setDraft({ kind: 'edit', row });
  };

  const openDay = (day: Date) => { setCursor(day); setView('day'); };
  const select = (item: CalendarItem) => setDraft({ kind: 'edit', row: item.row });
  const create = (start: Date, allDay = false) => setDraft({ kind: 'new', start, allDay });

  // Keyboard shortcuts, like Google Calendar: t, m, w, d, arrows, n.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (draft || imports.length || e.metaKey || e.ctrlKey || e.altKey) return;
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
  }, [draft, imports.length, view, cursor, setCursor, setView]);

  const error = calendars.error ?? events.error ?? categories.error;

  return (
    <div className="flex h-[100dvh] flex-col">
      <Header>
        <SearchBox onPick={openFromSearch} />
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
          {categories.data && <CategoryList categories={categories.data} />}
          <div>
            <button type="button" onClick={() => fileInput.current?.click()} className="btn-ghost w-full">
              <FileUp className="h-4 w-4" /> Import .ics or .csv
            </button>
            <p className="mt-2 px-1 text-xs text-foreground-de-emphasis">Or drop calendar files anywhere on the page.</p>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED}
              multiple
              className="hidden"
              onChange={(e) => { readFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}
            />
          </div>
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

          {importError && (
            <p className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
              {importError}
              <button type="button" onClick={() => setImportError(null)} className="text-amber-300/80 hover:text-amber-200">Dismiss</button>
            </p>
          )}

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
        <EventDialog draft={draft} calendars={calendars.data} categories={categories.data ?? []} onClose={() => setDraft(null)} />
      )}

      {imports[0] && calendars.data && (
        <ImportDialog
          key={imports[0].fileName + imports.length}
          parsed={imports[0]}
          calendars={calendars.data}
          onClose={() => setImports((q) => q.slice(1))}
          onDone={(start) => {
            if (start) { setCursor(start); setView('month'); }
            setImports((q) => q.slice(1));
          }}
        />
      )}

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-red-500 bg-surface-elevated/80 px-10 py-8 text-center">
            <FileUp className="mx-auto h-10 w-10 text-red-500" />
            <p className="mt-3 text-lg font-semibold text-foreground-emphasis">Drop to import</p>
            <p className="text-sm text-foreground-de-emphasis">.ics calendar files or .csv exports</p>
          </div>
        </div>
      )}
    </div>
  );
}
