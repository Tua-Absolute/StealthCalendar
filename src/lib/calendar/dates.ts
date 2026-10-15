import {
  addDays,
  addMonths,
  addWeeks,
  differenceInMinutes,
  format,
  isSameMonth,
  max as maxDate,
  min as minDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

export type View = 'month' | 'week' | 'day';

export interface Range {
  start: Date;
  /** Exclusive. */
  end: Date;
}

/** Minimal shape the layout helpers need, so they work on rows and drafts alike. */
export interface TimedItem {
  id: string;
  start: Date;
  end: Date;
  allDay: boolean;
}

export function getRange(view: View, cursor: Date): Range {
  if (view === 'month') {
    const start = startOfWeek(startOfMonth(cursor));
    return { start, end: addDays(start, 42) };
  }
  if (view === 'week') {
    const start = startOfWeek(cursor);
    return { start, end: addDays(start, 7) };
  }
  const start = startOfDay(cursor);
  return { start, end: addDays(start, 1) };
}

export function shiftCursor(view: View, cursor: Date, dir: 1 | -1): Date {
  if (view === 'month') return addMonths(cursor, dir);
  if (view === 'week') return addWeeks(cursor, dir);
  return addDays(cursor, dir);
}

export function rangeTitle(view: View, cursor: Date): string {
  if (view === 'month') return format(cursor, 'MMMM yyyy');
  if (view === 'day') return format(cursor, 'EEEE, MMMM d, yyyy');
  const { start, end } = getRange('week', cursor);
  const last = addDays(end, -1);
  if (isSameMonth(start, last)) return `${format(start, 'MMM d')} – ${format(last, 'd, yyyy')}`;
  if (start.getFullYear() === last.getFullYear())
    return `${format(start, 'MMM d')} – ${format(last, 'MMM d, yyyy')}`;
  return `${format(start, 'MMM d, yyyy')} – ${format(last, 'MMM d, yyyy')}`;
}

export function daysInRange({ start, end }: Range): Date[] {
  const days: Date[] = [];
  for (let d = start; d < end; d = addDays(d, 1)) days.push(d);
  return days;
}

export function overlaps(item: { start: Date; end: Date }, range: Range): boolean {
  // A zero-length event still shows on the day it starts.
  if (item.start.getTime() === item.end.getTime()) return item.start >= range.start && item.start < range.end;
  return item.start < range.end && item.end > range.start;
}

export function itemsOnDay<T extends TimedItem>(items: T[], day: Date): T[] {
  const range = { start: startOfDay(day), end: addDays(startOfDay(day), 1) };
  return items
    .filter((i) => overlaps(i, range))
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime());
}

export interface PositionedItem<T> {
  item: T;
  /** Minutes from midnight. */
  top: number;
  /** Minutes. */
  height: number;
  column: number;
  columns: number;
}

const MIN_HEIGHT = 20;

/**
 * Lays out timed items for one day column. Overlapping items share the width side by side,
 * the way Google and Outlook draw them.
 */
export function layoutDay<T extends TimedItem>(items: T[], day: Date): PositionedItem<T>[] {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const timed = items
    .filter((i) => !i.allDay && overlaps(i, { start: dayStart, end: dayEnd }))
    .map((item) => {
      const s = maxDate([item.start, dayStart]);
      const e = minDate([item.end, dayEnd]);
      const top = differenceInMinutes(s, dayStart);
      const height = Math.max(differenceInMinutes(e, s), MIN_HEIGHT);
      return { item, top, height, column: 0, columns: 1 };
    })
    .sort((a, b) => a.top - b.top || b.height - a.height);

  const result: PositionedItem<T>[] = [];
  let cluster: PositionedItem<T>[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    cluster.forEach((p) => (p.columns = colEnds.length));
    result.push(...cluster);
    cluster = [];
    colEnds = [];
  };

  for (const p of timed) {
    if (p.top >= clusterEnd && cluster.length) flush();
    let col = colEnds.findIndex((end) => end <= p.top);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(0);
    }
    colEnds[col] = p.top + p.height;
    p.column = col;
    cluster.push(p);
    clusterEnd = Math.max(clusterEnd, p.top + p.height);
  }
  if (cluster.length) flush();
  return result;
}

/** `yyyy-MM-ddTHH:mm` for datetime-local inputs, in local time. */
export function toLocalInput(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export function toDateInput(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}
