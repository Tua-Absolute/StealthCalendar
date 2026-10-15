import ICAL from 'ical.js';
import type { ImportedEvent, ParsedFile } from './types';
import { stableHash } from './types';

type ICalTime = InstanceType<typeof ICAL.Time>;
type ICalEvent = InstanceType<typeof ICAL.Event>;

/** Stop expanding a single repeating event after this many occurrences. */
const MAX_OCCURRENCES = 1000;

function toDate(t: ICalTime): Date {
  // All-day dates are calendar days, not instants: keep them at local midnight.
  if (t.isDate) return new Date(t.year, t.month - 1, t.day);
  return t.toJSDate();
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v ? v : null;
}

function firstCategory(event: ICalEvent): string | null {
  const prop = event.component.getFirstProperty('categories');
  if (!prop) return null;
  return clean(prop.getValues()[0]);
}

function toImported(event: ICalEvent, start: ICalTime, end: ICalTime, uid: string): ImportedEvent {
  const s = toDate(start);
  let e = toDate(end);
  if (e < s) e = s;
  return {
    uid,
    title: clean(event.summary) ?? '(No title)',
    description: clean(event.description),
    location: clean(event.location),
    start: s,
    end: e,
    allDay: start.isDate,
    category: firstCategory(event),
  };
}

export function parseIcs(text: string, fileName: string, now = new Date()): ParsedFile {
  const window = {
    start: new Date(now.getFullYear() - 1, now.getMonth(), 1),
    end: new Date(now.getFullYear() + 2, now.getMonth(), 1),
  };
  const warnings: string[] = [];

  const parsed = ICAL.parse(text);
  const roots = (Array.isArray(parsed[0]) ? parsed : [parsed]) as unknown[];
  const calendars = roots.map((jcal) => new ICAL.Component(jcal as ConstructorParameters<typeof ICAL.Component>[0]));

  let calendarName: string | null = null;
  const masters = new Map<string, ICalEvent>();
  const exceptions: ICalEvent[] = [];

  for (const cal of calendars) {
    calendarName ??= clean(cal.getFirstPropertyValue('x-wr-calname'));
    for (const tz of cal.getAllSubcomponents('vtimezone')) {
      ICAL.TimezoneService.register(tz);
    }
    for (const vevent of cal.getAllSubcomponents('vevent')) {
      if (String(vevent.getFirstPropertyValue('status') ?? '').toUpperCase() === 'CANCELLED') continue;
      const event = new ICAL.Event(vevent, { strictExceptions: false });
      if (!event.startDate) continue;
      if (!event.uid) {
        event.uid = `gen-${stableHash(`${event.summary}|${event.startDate.toString()}`)}`;
      }
      if (event.isRecurrenceException()) exceptions.push(event);
      else masters.set(event.uid, event);
    }
  }

  for (const ex of exceptions) {
    const master = masters.get(ex.uid);
    if (master) master.relateException(ex);
    else masters.set(`${ex.uid}::${ex.recurrenceId.toString()}`, ex);
  }

  const events: ImportedEvent[] = [];
  for (const [key, event] of Array.from(masters)) {
    if (!event.isRecurring()) {
      events.push(toImported(event, event.startDate, event.endDate, key));
      continue;
    }
    const it = event.iterator();
    let count = 0;
    for (let next = it.next(); next; next = it.next()) {
      const details = event.getOccurrenceDetails(next);
      const start = toDate(details.startDate);
      if (start >= window.end) break;
      if (++count > MAX_OCCURRENCES) {
        warnings.push(`"${event.summary}" repeats more than ${MAX_OCCURRENCES} times; only the first ${MAX_OCCURRENCES} were imported.`);
        break;
      }
      if (toDate(details.endDate) < window.start) continue;
      const uid = `${event.uid}::${details.recurrenceId.toString()}`;
      events.push(toImported(details.item, details.startDate, details.endDate, uid));
    }
  }

  events.sort((a, b) => a.start.getTime() - b.start.getTime());
  return { fileName, calendarName, events, window, warnings };
}
