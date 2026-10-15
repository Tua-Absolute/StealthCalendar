import { format } from 'date-fns';
import type { CalendarItem } from '@/lib/data/hooks';
import { cn } from '@/lib/utils';

/** Compact one-line event used in month cells and the all-day row. */
export function EventChip({ item, onClick, className }: {
  item: CalendarItem;
  onClick: (item: CalendarItem) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(item); }}
      title={item.title}
      className={cn(
        'flex w-full items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-left text-xs transition-opacity hover:opacity-80',
        item.allDay ? 'font-medium text-foreground-emphasis' : 'text-foreground-default',
        className
      )}
      style={item.allDay ? { background: `linear-gradient(${item.color}40, ${item.color}40), var(--color-surface-container)`, borderLeft: `3px solid ${item.color}` } : undefined}
    >
      {!item.allDay && (
        <>
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="flex-shrink-0 text-foreground-de-emphasis">{format(item.start, 'h:mmaaaaa')}</span>
        </>
      )}
      <span className="truncate">{item.title}</span>
    </button>
  );
}
