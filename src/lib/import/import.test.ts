import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseIcs } from './ics';
import { parseCsv, parseDate, parseTime } from './csv';

const ics = readFileSync(path.join(__dirname, '__fixtures__/sample.ics'), 'utf8');
const now = new Date('2026-10-15T12:00:00');

describe('parseIcs', () => {
  const parsed = parseIcs(ics, 'classes.ics', now);
  const byTitle = (t: string) => parsed.events.filter((e) => e.title === t);

  it('reads the calendar name and skips cancelled events', () => {
    expect(parsed.calendarName).toBe('NDSU Classes');
    expect(byTitle('Cancelled thing')).toHaveLength(0);
  });

  it('converts time zones to local time (tests run in Chicago)', () => {
    const [call] = byTitle('Call with NY office');
    expect(call.start).toEqual(new Date('2026-10-20T09:00:00'));
    expect(call.end).toEqual(new Date('2026-10-20T10:00:00'));
    expect(call.location).toBe('Zoom');
    expect(call.category).toBe('Work');
    expect(call.allDay).toBe(false);
  });

  it('keeps all-day events on their calendar days', () => {
    const [trip] = byTitle('Fall break');
    expect(trip.allDay).toBe(true);
    expect(trip.start).toEqual(new Date(2026, 9, 22));
    expect(trip.end).toEqual(new Date(2026, 9, 24));
  });

  it('expands repeating events, honoring EXDATE and moved occurrences', () => {
    const lectures = parsed.events.filter((e) => e.uid.startsWith('class-1::'));
    expect(lectures.map((e) => e.title)).toEqual([
      'CSCI 474 Lecture',
      'CSCI 474 Lecture (moved)',
      'CSCI 474 Lecture',
    ]);
    expect(lectures[1].start).toEqual(new Date('2026-10-19T12:00:00'));
    expect(new Set(lectures.map((e) => e.uid)).size).toBe(3);
    expect(lectures[0].category).toBe('School');
  });

  it('gives events without a UID a stable id and uses DURATION', () => {
    const [e] = byTitle('No uid event');
    expect(e.uid).toMatch(/^gen-/);
    expect(parseIcs(ics, 'x.ics', now).events.find((x) => x.title === 'No uid event')!.uid).toBe(e.uid);
    expect(e.end.getTime() - e.start.getTime()).toBe(30 * 60 * 1000);
  });
});

describe('parseCsv', () => {
  it('reads an Outlook-style export', () => {
    const csv = [
      'Subject,Start Date,Start Time,End Date,End Time,All day event,Categories,Description,Location',
      'Dentist,10/16/2026,2:00:00 PM,10/16/2026,3:00:00 PM,False,Health,Cleaning,Main St',
      'Vacation,10/26/2026,12:00:00 AM,10/28/2026,12:00:00 AM,True,,,',
      ',10/16/2026,,,,,,,',
    ].join('\n');
    const parsed = parseCsv(csv, 'outlook.csv');
    expect(parsed.events).toHaveLength(2);
    const [dentist, vacation] = parsed.events;
    expect(dentist).toMatchObject({ title: 'Dentist', category: 'Health', location: 'Main St', allDay: false });
    expect(dentist.start).toEqual(new Date(2026, 9, 16, 14, 0));
    expect(vacation.allDay).toBe(true);
    expect(vacation.start).toEqual(new Date(2026, 9, 26));
    expect(vacation.end).toEqual(new Date(2026, 9, 28));
    expect(parsed.warnings[0]).toMatch(/1 row/);
  });

  it('treats a single all-day date as one day', () => {
    const parsed = parseCsv('Subject,Start Date\nBirthday,2026-11-03', 'b.csv');
    expect(parsed.events[0].end).toEqual(new Date(2026, 10, 4));
  });

  it('parses common date and time formats', () => {
    expect(parseDate('2026-10-15')).toEqual({ y: 2026, m: 10, d: 15 });
    expect(parseDate('10/15/26')).toEqual({ y: 2026, m: 10, d: 15 });
    expect(parseTime('12:30 AM')).toEqual({ h: 0, min: 30 });
    expect(parseTime('1:05 pm')).toEqual({ h: 13, min: 5 });
    expect(parseTime('17:45')).toEqual({ h: 17, min: 45 });
  });
});
