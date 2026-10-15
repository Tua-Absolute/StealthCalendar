'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Search, X } from 'lucide-react';
import { useSearchEvents } from '@/lib/data/hooks';
import type { EventRow } from '@/lib/data/types';
import { cn } from '@/lib/utils';

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SearchBox({ onPick }: { onPick: (row: EventRow) => void }) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const debounced = useDebounced(term, 250);
  const results = useSearchEvents(debounced);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        setMobileOpen(true);
        inputRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const pick = (row: EventRow) => {
    onPick(row);
    setOpen(false);
    setMobileOpen(false);
    setTerm('');
  };

  const showResults = open && debounced.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative">
      <button type="button" onClick={() => { setMobileOpen(true); setTimeout(() => inputRef.current?.focus()); }}
        className={cn('icon-button sm:hidden', mobileOpen && 'hidden')} aria-label="Search">
        <Search className="h-5 w-5" />
      </button>
      <div className={cn(
        'items-center gap-2 rounded-xl border border-border-default bg-surface-container px-3 focus-within:ring-2 focus-within:ring-red-500/60',
        mobileOpen ? 'fixed inset-x-3 top-3 z-50 flex h-10 sm:static sm:h-9' : 'hidden sm:flex h-9 w-56 lg:w-72'
      )}>
        <Search className="h-4 w-4 flex-shrink-0 text-foreground-de-emphasis" />
        <input
          ref={inputRef}
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setMobileOpen(false); inputRef.current?.blur(); } }}
          placeholder="Search events"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground-emphasis placeholder:text-foreground-de-emphasis focus:outline-none"
        />
        {(term || mobileOpen) && (
          <button type="button" onClick={() => { setTerm(''); setMobileOpen(false); }} aria-label="Clear search"
            className="text-foreground-de-emphasis hover:text-foreground-emphasis">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {showResults && (
        <div className={cn(
          'z-50 max-h-96 overflow-y-auto rounded-xl border border-border-default bg-surface-elevated p-1 shadow-2xl',
          mobileOpen ? 'fixed inset-x-3 top-14 sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96' : 'absolute right-0 top-11 w-96'
        )}>
          {results.isError && <p className="p-3 text-sm text-red-400">Search failed: {results.error.message}</p>}
          {results.data?.length === 0 && <p className="p-3 text-sm text-foreground-de-emphasis">No events match “{debounced}”.</p>}
          {results.data?.map((row) => (
            <button key={row.id} type="button" onClick={() => pick(row)}
              className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-white/5">
              <span className="truncate text-sm text-foreground-emphasis">{row.title}</span>
              <span className="truncate text-xs text-foreground-de-emphasis">
                {format(new Date(row.start_at), row.all_day ? 'EEE, MMM d, yyyy' : 'EEE, MMM d, yyyy · h:mm a')}
                {row.location ? ` · ${row.location}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
