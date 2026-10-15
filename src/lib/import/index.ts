import { parseCsv } from './csv';
import { parseIcs } from './ics';
import type { ParsedFile } from './types';

export type { ImportedEvent, ParsedFile } from './types';

export const ACCEPTED = '.ics,.ical,.ifb,.icalendar,.csv,text/calendar,text/csv';

export function canImport(file: File): boolean {
  return /\.(ics|ical|ifb|icalendar|csv)$/i.test(file.name) || ['text/calendar', 'text/csv'].includes(file.type);
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const text = await file.text();
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  if (isCsv) return parseCsv(text, file.name);
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error(`${file.name} is not a calendar file.`);
  return parseIcs(text, file.name);
}

/** Calendar name to suggest for an import: the file's own name for itself, else the file name. */
export function suggestedName(parsed: ParsedFile): string {
  return parsed.calendarName ?? parsed.fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}
