'use client';

import { useEffect, useRef, useState } from 'react';
import { addMinutes, format, isToday, startOfDay } from 'date-fns';
import { daysInRange, itemsOnDay, layoutDay, type Range } from '@/lib/calendar/dates';
import type { CalendarItem } from '@/lib/data/hooks';
import { cn } from '@/lib/utils';
import { EventChip } from './EventChip';

const HOUR_PX = 48;
const PX_PER_MIN = HOUR_PX / 60;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Week and day views: an all-day row above a scrolling 24-hour grid. */
export function TimeGridView({ range, items, onSelect, onCreate, onOpenDay }: {
  range: Range;
  items: CalendarItem[];
  onSelect: (item: CalendarItem) => void;
  onCreate: (start: Date, allDay?: boolean) => void;
  onOpenDay: (day: Date) => void;
}) {
  const days = daysInRange(range);
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = useNow();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 7 * HOUR_PX });
  }, []);

  const cols = { gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` };

  const createAt = (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const minutes = Math.floor(y / PX_PER_MIN / 30) * 30;
    onCreate(addMinutes(startOfDay(day), minutes));
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border-default bg-surface-container overflow-hidden">
      <div className="grid border-b border-border-default" style={cols}>
        <div />
        {days.map((day) => (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onOpenDay(day)}
            className="flex flex-col items-center py-2 hover:bg-white/[0.03]"
          >
            <span className="text-xs uppercase tracking-wide text-foreground-de-emphasis">{format(day, 'EEE')}</span>
            <span className={cn(
              'mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold',
              isToday(day) ? 'bg-red-600 text-white' : 'text-foreground-emphasis'
            )}>
              {format(day, 'd')}
            </span>
          </button>
        ))}
      </div>

      <div className="grid border-b border-border-default" style={cols}>
        <div className="py-1 pr-2 text-right text-[10px] uppercase text-foreground-de-emphasis self-center">All day</div>
        {days.map((day) => (
          <div
            key={day.toISOString()}
            onClick={() => onCreate(startOfDay(day), true)}
            className="min-h-[28px] space-y-0.5 border-l border-border-default p-0.5 cursor-pointer"
          >
            {itemsOnDay(items, day).filter((i) => i.allDay).map((item) => (
              <EventChip key={item.id} item={item} onClick={onSelect} />
            ))}
          </div>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="relative grid" style={{ ...cols, height: 24 * HOUR_PX }}>
          <div className="relative">
            {HOURS.slice(1).map((h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-foreground-de-emphasis"
                style={{ top: h * HOUR_PX }}
              >
                {format(new Date(2000, 0, 1, h), 'h a')}
              </span>
            ))}
          </div>
          {days.map((day) => (
            <div
              key={day.toISOString()}
              onClick={(e) => createAt(day, e)}
              className={cn('relative border-l border-border-default cursor-pointer', isToday(day) && 'bg-red-500/[0.03]')}
            >
              {HOURS.map((h) => (
                <div key={h} className="border-b border-border-default" style={{ height: HOUR_PX }} />
              ))}
              {layoutDay(items, day).map(({ item, top, height, column, columns }) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onSelect(item); }}
                  className="absolute overflow-hidden rounded-lg px-1.5 py-1 text-left text-xs transition-opacity hover:opacity-90"
                  style={{
                    top: top * PX_PER_MIN,
                    height: height * PX_PER_MIN - 2,
                    left: `calc(${(column / columns) * 100}% + 2px)`,
                    width: `calc(${100 / columns}% - 4px)`,
                    background: `linear-gradient(${item.color}40, ${item.color}40), var(--color-surface-container)`,
                    borderLeft: `3px solid ${item.color}`,
                  }}
                >
                  <div className="truncate font-medium text-foreground-emphasis">{item.title}</div>
                  {height >= 40 && (
                    <div className="truncate text-foreground-de-emphasis">
                      {format(item.start, 'h:mm a')} – {format(item.end, 'h:mm a')}
                    </div>
                  )}
                </button>
              ))}
              {isToday(day) && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-red-500"
                  style={{ top: (now.getHours() * 60 + now.getMinutes()) * PX_PER_MIN }}
                >
                  <span className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
