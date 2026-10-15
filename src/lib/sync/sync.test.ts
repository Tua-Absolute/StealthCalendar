import { describe, expect, it } from 'vitest';
import { fromGoogle, toGoogle } from './google';
import { fromGraph, toGraph } from './outlook';
import { dateInZone, zoneDate } from './tz';

describe('time zone helpers', () => {
  it('finds midnight of a date in a zone', () => {
    expect(dateInZone('2026-10-22', 'America/Chicago').toISOString()).toBe('2026-10-22T05:00:00.000Z');
    expect(dateInZone('2026-12-22', 'America/Chicago').toISOString()).toBe('2026-12-22T06:00:00.000Z');
    expect(dateInZone('2026-10-22T00:00:00.0000000', 'Europe/Berlin').toISOString()).toBe('2026-10-21T22:00:00.000Z');
  });
  it('reads the calendar date of an instant in a zone', () => {
    expect(zoneDate(new Date('2026-10-22T03:00:00Z'), 'America/Chicago')).toBe('2026-10-21');
    expect(zoneDate(new Date('2026-10-22T05:00:00Z'), 'America/Chicago')).toBe('2026-10-22');
  });
});

describe('Google mapping', () => {
  const tz = 'America/Chicago';
  it('reads timed and all-day events and skips cancelled ones', () => {
    const timed = fromGoogle({ id: 'a', summary: ' Standup ', start: { dateTime: '2026-10-20T09:00:00-05:00' }, end: { dateTime: '2026-10-20T09:15:00-05:00' } }, tz)!;
    expect(timed).toMatchObject({ id: 'a', title: 'Standup', allDay: false, description: null });
    expect(timed.start.toISOString()).toBe('2026-10-20T14:00:00.000Z');
    const allDay = fromGoogle({ id: 'b', start: { date: '2026-10-22' }, end: { date: '2026-10-24' } }, tz)!;
    expect(allDay).toMatchObject({ title: '(No title)', allDay: true });
    expect(allDay.start).toEqual(dateInZone('2026-10-22', tz));
    expect(allDay.end).toEqual(dateInZone('2026-10-24', tz));
    expect(fromGoogle({ id: 'c', status: 'cancelled', start: { dateTime: '2026-10-20T09:00:00Z' } }, tz)).toBeNull();
  });
  it('writes all-day events as dates and clears dateTime', () => {
    const body = toGoogle({ title: 'Trip', description: null, location: null, start: dateInZone('2026-10-22', tz), end: dateInZone('2026-10-24', tz), allDay: true }, tz);
    expect(body.start).toEqual({ date: '2026-10-22', dateTime: null });
    expect(body.end).toEqual({ date: '2026-10-24', dateTime: null });
  });
  it('writes timed events as UTC instants', () => {
    const body = toGoogle({ title: 'Call', description: 'x', location: 'Zoom', start: new Date('2026-10-20T14:00:00Z'), end: new Date('2026-10-20T15:00:00Z'), allDay: false }, tz);
    expect(body.start).toEqual({ dateTime: '2026-10-20T14:00:00.000Z', date: null });
  });
});

describe('Outlook mapping', () => {
  const tz = 'America/Chicago';
  it('reads UTC times without an offset and all-day dates', () => {
    const timed = fromGraph({
      id: 'x', subject: 'Dentist', body: { contentType: 'text', content: ' Cleaning ' }, location: { displayName: 'Main St' },
      start: { dateTime: '2026-10-16T19:00:00.0000000', timeZone: 'UTC' }, end: { dateTime: '2026-10-16T20:00:00.0000000', timeZone: 'UTC' },
    }, tz)!;
    expect(timed).toMatchObject({ title: 'Dentist', description: 'Cleaning', location: 'Main St', allDay: false });
    expect(timed.start.toISOString()).toBe('2026-10-16T19:00:00.000Z');
    const allDay = fromGraph({
      id: 'y', subject: 'Vacation', isAllDay: true,
      start: { dateTime: '2026-10-26T00:00:00.0000000', timeZone: 'UTC' }, end: { dateTime: '2026-10-28T00:00:00.0000000', timeZone: 'UTC' },
    }, tz)!;
    expect(allDay.start).toEqual(dateInZone('2026-10-26', tz));
    expect(allDay.end).toEqual(dateInZone('2026-10-28', tz));
    expect(fromGraph({ id: 'z', isCancelled: true, start: { dateTime: '2026-10-16T19:00:00', timeZone: 'UTC' }, end: { dateTime: '2026-10-16T20:00:00', timeZone: 'UTC' } }, tz)).toBeNull();
  });
  it('writes all-day events as local midnights in the user zone and timed events in UTC', () => {
    const allDay = toGraph({ title: 'Trip', description: null, location: null, start: dateInZone('2026-10-22', tz), end: dateInZone('2026-10-24', tz), allDay: true }, tz);
    expect(allDay).toMatchObject({ isAllDay: true, start: { dateTime: '2026-10-22T00:00:00', timeZone: tz }, end: { dateTime: '2026-10-24T00:00:00', timeZone: tz } });
    const timed = toGraph({ title: 'Call', description: null, location: null, start: new Date('2026-10-20T14:00:00Z'), end: new Date('2026-10-20T15:00:00Z'), allDay: false }, tz);
    expect(timed.start).toEqual({ dateTime: '2026-10-20T14:00:00.000', timeZone: 'UTC' });
  });
});
