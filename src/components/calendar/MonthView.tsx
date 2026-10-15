'use client';

import { format, isSameMonth, isToday, setHours } from 'date-fns';
import { daysInRange, itemsOnDay, type Range } from '@/lib/calendar/dates';
import type { CalendarItem } from '@/lib/data/hooks';
import { cn } from '@/lib/utils';
import { EventChip } from './EventChip';

const MAX_PER_CELL = 3;

export function MonthView({ range, cursor, items, onSelect, onCreate, onOpenDay }: {
  range: Range;
  cursor: Date;
  items: CalendarItem[];
  onSelect: (item: CalendarItem) => void;
  onCreate: (start: Date) => void;
  onOpenDay: (day: Date) => void;
}) {
  const days = daysInRange(range);
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border-default bg-surface-container overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border-default">
        {days.slice(0, 7).map((d) => (
          <div key={d.toISOString()} className="py-2 text-center text-xs font-medium uppercase tracking-wide text-foreground-de-emphasis">
            <span className="hidden sm:inline">{format(d, 'EEE')}</span>
            <span className="sm:hidden">{format(d, 'EEEEE')}</span>
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {days.map((day) => {
          const dayItems = itemsOnDay(items, day);
          const extra = dayItems.length - MAX_PER_CELL;
          return (
            <div
              key={day.toISOString()}
              onClick={() => onCreate(setHours(day, 9))}
              className={cn(
                'min-h-[84px] sm:min-h-[110px] border-b border-r border-border-default p-1 cursor-pointer transition-colors hover:bg-white/[0.02] [&:nth-child(7n)]:border-r-0',
                !isSameMonth(day, cursor) && 'bg-surface/40'
              )}
            >
              <div className="mb-1 flex justify-end">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onOpenDay(day); }}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium hover:bg-white/10',
                    isToday(day)
                      ? 'bg-red-600 text-white hover:bg-red-500'
                      : isSameMonth(day, cursor) ? 'text-foreground-emphasis' : 'text-foreground-de-emphasis/60'
                  )}
                >
                  {format(day, 'd')}
                </button>
              </div>
              <div className="space-y-0.5">
                {dayItems.slice(0, MAX_PER_CELL).map((item) => (
                  <EventChip key={item.id} item={item} onClick={onSelect} />
                ))}
                {extra > 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpenDay(day); }}
                    className="px-1.5 text-xs font-medium text-red-400 hover:text-red-300"
                  >
                    +{extra} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
