'use client';

import { useState } from 'react';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useDeleteCategory, useSaveCategory } from '@/lib/data/hooks';
import { PALETTE, type CategoryRow } from '@/lib/data/types';
import { ColorPicker } from './ColorPicker';

export function CategoryList({ categories }: { categories: CategoryRow[] }) {
  const save = useSaveCategory();
  const remove = useDeleteCategory();
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await save.mutateAsync({ name, color: PALETTE[(categories.length + 3) % PALETTE.length] });
    setNewName('');
  };

  const del = (cat: CategoryRow) => {
    if (window.confirm(`Delete the "${cat.name}" category? Its events stay, without a category.`)) remove.mutate(cat.id);
  };

  return (
    <div>
      <h3 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-foreground-de-emphasis">Categories</h3>
      {categories.length === 0 && (
        <p className="px-1 pb-1 text-xs text-foreground-de-emphasis">Tag events to color them across calendars.</p>
      )}
      <ul className="space-y-0.5">
        {categories.map((cat) => (
          <li key={cat.id}>
            <div className="group flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/5">
              <button
                type="button"
                onClick={() => setEditing(editing === cat.id ? null : cat.id)}
                className="h-3.5 w-3.5 flex-shrink-0 rounded ring-offset-2 ring-offset-surface hover:ring-2 hover:ring-white/30"
                style={{ backgroundColor: cat.visible ? cat.color : 'transparent', border: `2px solid ${cat.color}` }}
                aria-label={`Change ${cat.name} color`}
              />
              <span className={`flex-1 truncate text-sm ${cat.visible ? 'text-foreground-emphasis' : 'text-foreground-de-emphasis line-through'}`}>
                {cat.name}
              </span>
              <button type="button" onClick={() => save.mutate({ id: cat.id, visible: !cat.visible })}
                className="text-foreground-de-emphasis hover:text-foreground-emphasis" aria-label={cat.visible ? 'Hide' : 'Show'}>
                {cat.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => del(cat)}
                className="hidden group-hover:block text-foreground-de-emphasis hover:text-red-400" aria-label="Delete category">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {editing === cat.id && (
              <div className="px-2 py-2">
                <ColorPicker value={cat.color} onChange={(c) => c && save.mutate({ id: cat.id, color: c })} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-2 flex gap-1">
        <input className="field py-1.5" placeholder="New category" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit" className="icon-button" aria-label="Add category"><Plus className="h-5 w-5" /></button>
      </form>
    </div>
  );
}
