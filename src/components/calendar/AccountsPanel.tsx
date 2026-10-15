'use client';

import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Plus, RefreshCw, Unplug } from 'lucide-react';
import { useAccounts, useDisconnectAccount, useSyncNow } from '@/lib/data/hooks';
import type { CalendarRow } from '@/lib/data/types';
import { cn } from '@/lib/utils';

const LABEL = { google: 'Google', outlook: 'Outlook' } as const;

export function ProviderMark({ provider, className }: { provider: 'google' | 'outlook'; className?: string }) {
  return (
    <span
      className={cn('inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-[9px] font-bold text-white', className)}
      style={{ backgroundColor: provider === 'google' ? '#4285f4' : '#0f6cbd' }}
      aria-label={LABEL[provider]}
    >
      {provider === 'google' ? 'G' : 'O'}
    </span>
  );
}

export function AccountsPanel({ calendars, sync }: { calendars: CalendarRow[]; sync: ReturnType<typeof useSyncNow> }) {
  const accounts = useAccounts();
  const disconnect = useDisconnectAccount();

  const connectHref = (p: 'google' | 'outlook') =>
    `/api/connect/${p}?tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`;

  const remote = calendars.filter((c) => c.account_id && c.visible);
  const lastSynced = remote
    .map((c) => c.last_synced_at)
    .filter((t): t is string => !!t)
    .sort()
    .at(-1);
  const errors = Array.from(new Set(remote.map((c) => c.sync_error).filter(Boolean)));

  const remove = (id: string, email: string) => {
    if (window.confirm(`Disconnect ${email}? Its calendars disappear from StealthCalendar. Nothing is deleted from your ${email} account.`)) {
      disconnect.mutate(id);
    }
  };

  return (
    <div>
      <h3 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-foreground-de-emphasis">Connected accounts</h3>
      <ul className="space-y-0.5">
        {accounts.data?.map((a) => (
          <li key={a.id} className="group flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/5">
            <ProviderMark provider={a.provider} />
            <span className="flex-1 truncate text-sm text-foreground-emphasis" title={a.email}>{a.email}</span>
            <button type="button" onClick={() => remove(a.id, a.email)} aria-label={`Disconnect ${a.email}`}
              className="hidden group-hover:block text-foreground-de-emphasis hover:text-red-400">
              <Unplug className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      {accounts.data && accounts.data.length > 0 && (
        <div className="mt-1 flex items-center justify-between px-2 text-xs text-foreground-de-emphasis">
          <span>
            {sync.isPending ? 'Syncing…' : lastSynced ? `Synced ${formatDistanceToNow(new Date(lastSynced), { addSuffix: true })}` : 'Not synced yet'}
          </span>
          <button type="button" onClick={() => sync.mutate()} disabled={sync.isPending}
            className="flex items-center gap-1 text-foreground-de-emphasis hover:text-foreground-emphasis disabled:opacity-50">
            <RefreshCw className={cn('h-3.5 w-3.5', sync.isPending && 'animate-spin')} /> Sync now
          </button>
        </div>
      )}

      {(errors.length > 0 || sync.error) && (
        <div className="mt-2 flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <div className="space-y-1">
            {sync.error && <p>{sync.error.message}</p>}
            {errors.map((e) => <p key={e}>{e}</p>)}
          </div>
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2">
        {(['google', 'outlook'] as const).map((p) => (
          <a key={p} href={connectHref(p)} className="btn-ghost px-2 text-xs">
            <Plus className="h-3.5 w-3.5" /> {LABEL[p]}
          </a>
        ))}
      </div>
    </div>
  );
}
