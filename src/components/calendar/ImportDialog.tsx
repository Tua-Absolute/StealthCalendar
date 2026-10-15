'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, FileUp, X } from 'lucide-react';
import { suggestedName, type ParsedFile } from '@/lib/import';
import { useImportEvents, type ImportResult } from '@/lib/data/hooks';
import { PALETTE, type CalendarRow } from '@/lib/data/types';
import { ColorPicker } from './ColorPicker';

function when(e: ParsedFile['events'][number]) {
  return e.allDay ? format(e.start, 'EEE, MMM d, yyyy') : format(e.start, 'EEE, MMM d, yyyy · h:mm a');
}

export function ImportDialog({ parsed, calendars, onClose, onDone }: {
  parsed: ParsedFile;
  calendars: CalendarRow[];
  onClose: () => void;
  /** Called after a successful import with the first imported event's start, to jump there. */
  onDone: (firstStart: Date | null) => void;
}) {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [name, setName] = useState(() => suggestedName(parsed));
  const [color, setColor] = useState<string>(PALETTE[(calendars.length + 5) % PALETTE.length]);
  // Imports stay in StealthCalendar; they are never pushed into Google or Outlook calendars.
  const targets = calendars.filter((c) => !c.account_id);
  const [calendarId, setCalendarId] = useState(targets[0]?.id ?? '');
  const [result, setResult] = useState<ImportResult | null>(null);
  const importEvents = useImportEvents();
  const { events } = parsed;

  const upcoming = events.find((e) => e.end >= new Date()) ?? events[0] ?? null;

  const run = async () => {
    const target = mode === 'new'
      ? { kind: 'new' as const, name: name.trim() || 'Imported', color }
      : { kind: 'existing' as const, calendarId };
    setResult(await importEvents.mutateAsync({ events, target }));
  };

  const categories = Array.from(new Set(events.map((e) => e.category).filter(Boolean)));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border-default bg-surface-elevated p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileUp className="h-5 w-5 flex-shrink-0 text-red-500" />
            <h2 className="truncate text-base font-semibold text-foreground-emphasis">Import {parsed.fileName}</h2>
          </div>
          <button type="button" onClick={onClose} className="icon-button" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              <p>
                Added {result.added} event{result.added === 1 ? '' : 's'}
                {result.updated > 0 && <> and updated {result.updated} you already had</>}.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-ghost">Close</button>
              <button type="button" onClick={() => onDone(upcoming?.start ?? null)} className="btn-primary">Show me</button>
            </div>
          </div>
        ) : events.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground-default">No events were found in this file.</p>
            {parsed.warnings.map((w) => <p key={w} className="text-sm text-amber-300">{w}</p>)}
            <div className="flex justify-end"><button type="button" onClick={onClose} className="btn-ghost">Close</button></div>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border-default bg-surface p-3 text-sm">
              <p className="text-foreground-emphasis">
                <span className="font-semibold">{events.length}</span> event{events.length === 1 ? '' : 's'} from{' '}
                {format(events[0].start, 'MMM d, yyyy')} to {format(events[events.length - 1].start, 'MMM d, yyyy')}
              </p>
              {categories.length > 0 && (
                <p className="mt-1 text-foreground-de-emphasis">Categories: {categories.join(', ')}</p>
              )}
              <ul className="mt-3 space-y-1">
                {(upcoming ? events.slice(events.indexOf(upcoming), events.indexOf(upcoming) + 4) : []).map((e) => (
                  <li key={e.uid} className="flex justify-between gap-3 text-xs">
                    <span className="truncate text-foreground-default">{e.title}</span>
                    <span className="flex-shrink-0 text-foreground-de-emphasis">{when(e)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {parsed.warnings.map((w) => <p key={w} className="text-sm text-amber-300">{w}</p>)}

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-foreground-default">
                <input type="radio" className="accent-red-600" checked={mode === 'new'} onChange={() => setMode('new')} />
                Add as a new calendar
              </label>
              {mode === 'new' && (
                <div className="space-y-3 pl-6">
                  <input className="field" value={name} onChange={(e) => setName(e.target.value)} aria-label="Calendar name" />
                  <ColorPicker value={color} onChange={(c) => c && setColor(c)} />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-foreground-default">
                <input type="radio" className="accent-red-600" checked={mode === 'existing'} onChange={() => setMode('existing')} />
                Add to a calendar I have
              </label>
              {mode === 'existing' && (
                <div className="pl-6">
                  <select className="field" value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
                    {targets.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-foreground-de-emphasis">Events already imported from this file are updated, not duplicated.</p>
                </div>
              )}
            </div>

            {importEvents.error && <p className="text-sm text-red-400">{importEvents.error.message}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
              <button type="button" onClick={run} disabled={importEvents.isPending} className="btn-primary">
                {importEvents.isPending ? 'Importing…' : `Import ${events.length} event${events.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
