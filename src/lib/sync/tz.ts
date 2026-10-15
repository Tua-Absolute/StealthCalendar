import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

/** Midnight at the start of a calendar date (`yyyy-MM-dd`) in a time zone. */
export function dateInZone(date: string, tz: string): Date {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return new Date(new TZDate(y, m - 1, d, tz).getTime());
}

/** The calendar date (`yyyy-MM-dd`) an instant falls on in a time zone. */
export function zoneDate(instant: Date, tz: string): string {
  return format(new TZDate(instant.getTime(), tz), 'yyyy-MM-dd');
}

export function isValidZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
