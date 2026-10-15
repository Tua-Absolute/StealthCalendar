'use client';

import { useState } from 'react';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useDeleteCalendar, useSaveCalendar } from '@/lib/data/hooks';
import { PALETTE, type CalendarRow } from '@/lib/data/types';
import { ColorPicker } from './ColorPicker';

export function CalendarList({ calendars }: { calendars: CalendarRow[] }) {
  const save = useSaveCalendar();
  const remove = useDeleteCalendar();
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await save.mutateAsync({ name, color: PALETTE[calendars.length % PALETTE.length] });
    setNewName('');
  };

  const del = (cal: CalendarRow) => {
    if (calendars.length <= 1) return;
    if (window.confirm(`Delete "${cal.name}" and all of its events?`)) remove.mutate(cal.id);
  };

  return (
    <div>
      <h3 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-foreground-de-emphasis">Calendars</h3>
      <ul className="space-y-0.5">
        {calendars.map((cal) => (
          <li key={cal.id}>
            <div className="group flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/5">
              <button
                type="button"
                onClick={() => setEditing(editing === cal.id ? null : cal.id)}
                className="h-3.5 w-3.5 flex-shrink-0 rounded-full ring-offset-2 ring-offset-surface hover:ring-2 hover:ring-white/30"
                style={{ backgroundColor: cal.visible ? cal.color : 'transparent', border: `2px solid ${cal.color}` }}
                aria-label={`Change ${cal.name} color`}
              />
              <span className={`flex-1 truncate text-sm ${cal.visible ? 'text-foreground-emphasis' : 'text-foreground-de-emphasis line-through'}`}>
                {cal.name}
              </span>
              <button type="button" onClick={() => save.mutate({ id: cal.id, visible: !cal.visible })}
                className="text-foreground-de-emphasis hover:text-foreground-emphasis" aria-label={cal.visible ? 'Hide' : 'Show'}>
                {cal.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              {calendars.length > 1 && (
                <button type="button" onClick={() => del(cal)}
                  className="hidden group-hover:block text-foreground-de-emphasis hover:text-red-400" aria-label="Delete calendar">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {editing === cal.id && (
              <div className="px-2 py-2">
                <ColorPicker value={cal.color} onChange={(c) => c && save.mutate({ id: cal.id, color: c })} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-2 flex gap-1">
        <input className="field py-1.5" placeholder="New calendar" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit" className="icon-button" aria-label="Add calendar"><Plus className="h-5 w-5" /></button>
      </form>
    </div>
  );
}
