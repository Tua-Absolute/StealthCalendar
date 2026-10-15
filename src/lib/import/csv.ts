import Papa from 'papaparse';
import type { ImportedEvent, ParsedFile } from './types';
import { stableHash } from './types';

/**
 * Reads the CSV exports Google Calendar and Outlook produce:
 * Subject, Start Date, Start Time, End Date, End Time, All Day Event, Description, Location, Categories.
 */

function pick(row: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const v = row[name];
    if (v !== undefined && v.trim() !== '') return v.trim();
  }
  return '';
}

/** Accepts 10/15/2026, 2026-10-15 and 15.10.2026 style dates (month first when ambiguous with slashes). */
export function parseDate(value: string): { y: number; m: number; d: number } | null {
  let m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return { y: m[3].length === 2 ? 2000 + +m[3] : +m[3], m: +m[1], d: +m[2] };
  m = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return { y: +m[3], m: +m[2], d: +m[1] };
  return null;
}

/** Accepts 9:00 AM, 9:00:00 PM, 13:30. */
export function parseTime(value: string): { h: number; min: number } | null {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (!m) return null;
  let h = +m[1];
  const ampm = m[3]?.toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return { h, min: +m[2] };
}

function isTrue(value: string) {
  return /^(true|yes|1)$/i.test(value);
}

export function parseCsv(text: string, fileName: string): ParsedFile {
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const warnings: string[] = [];
  const events: ImportedEvent[] = [];
  let skipped = 0;

  for (const row of result.data) {
    const title = pick(row, 'subject', 'title', 'summary', 'name');
    const sd = parseDate(pick(row, 'start date', 'date', 'start'));
    if (!title || !sd) {
      skipped++;
      continue;
    }
    const ed = parseDate(pick(row, 'end date')) ?? sd;
    const st = parseTime(pick(row, 'start time'));
    const et = parseTime(pick(row, 'end time'));
    const allDay = isTrue(pick(row, 'all day event', 'all day')) || !st;

    let start: Date;
    let end: Date;
    if (allDay) {
      start = new Date(sd.y, sd.m - 1, sd.d);
      end = new Date(ed.y, ed.m - 1, ed.d + 1);
      // Outlook writes all-day events with an exclusive end date already.
      if (end.getTime() - start.getTime() > 86400000 && et && et.h === 0 && et.min === 0) {
        end = new Date(ed.y, ed.m - 1, ed.d);
      }
    } else {
      start = new Date(sd.y, sd.m - 1, sd.d, st!.h, st!.min);
      end = et ? new Date(ed.y, ed.m - 1, ed.d, et.h, et.min) : new Date(start.getTime() + 3600000);
    }
    if (end < start) end = start;

    events.push({
      uid: `csv-${stableHash(`${title}|${start.toISOString()}`)}`,
      title,
      description: pick(row, 'description', 'notes') || null,
      location: pick(row, 'location') || null,
      start,
      end,
      allDay,
      category: pick(row, 'categories', 'category').split(/[;,]/)[0].trim() || null,
    });
  }

  if (skipped) warnings.push(`${skipped} row${skipped === 1 ? '' : 's'} had no title or start date and ${skipped === 1 ? 'was' : 'were'} skipped.`);
  if (result.errors.length) warnings.push(`Some rows could not be read (${result.errors[0].message}).`);
  events.sort((a, b) => a.start.getTime() - b.start.getTime());
  const now = new Date();
  return { fileName, calendarName: null, events, window: { start: now, end: now }, warnings };
}
