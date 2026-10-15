import { describe, expect, it } from 'vitest';
import { getRange, itemsOnDay, layoutDay, rangeTitle, shiftCursor } from './dates';

const d = (s: string) => new Date(s);
const ev = (id: string, start: string, end: string, allDay = false) => ({
  id,
  start: d(start),
  end: d(end),
  allDay,
});

describe('getRange', () => {
  it('month view covers six full weeks starting on Sunday', () => {
    const r = getRange('month', d('2026-10-15T12:00'));
    expect(r.start).toEqual(d('2026-09-27T00:00'));
    expect(r.end).toEqual(d('2026-11-08T00:00'));
  });
  it('week view starts on Sunday', () => {
    const r = getRange('week', d('2026-10-15T12:00'));
    expect(r.start).toEqual(d('2026-10-11T00:00'));
    expect(r.end).toEqual(d('2026-10-18T00:00'));
  });
  it('day view is one day', () => {
    const r = getRange('day', d('2026-10-15T12:00'));
    expect(r.end.getTime() - r.start.getTime()).toBe(24 * 3600 * 1000);
  });
});

describe('navigation and titles', () => {
  it('shifts by the view unit', () => {
    expect(shiftCursor('week', d('2026-10-15T12:00'), 1)).toEqual(d('2026-10-22T12:00'));
    expect(shiftCursor('month', d('2026-10-15T12:00'), -1)).toEqual(d('2026-09-15T12:00'));
  });
  it('formats week titles across months', () => {
    expect(rangeTitle('week', d('2026-09-30T12:00'))).toBe('Sep 27 – Oct 3, 2026');
    expect(rangeTitle('week', d('2026-11-02T12:00'))).toBe('Nov 1 – 7, 2026');
  });
});

describe('itemsOnDay', () => {
  it('includes multi-day events on every day they span and puts all-day first', () => {
    const items = [
      ev('a', '2026-10-14T22:00', '2026-10-15T01:00'),
      ev('b', '2026-10-15T00:00', '2026-10-16T00:00', true),
      ev('c', '2026-10-16T00:00', '2026-10-16T01:00'),
    ];
    expect(itemsOnDay(items, d('2026-10-15T00:00')).map((i) => i.id)).toEqual(['b', 'a']);
  });
});

describe('layoutDay', () => {
  it('splits overlapping events into columns and leaves separate ones full width', () => {
    const items = [
      ev('a', '2026-10-15T09:00', '2026-10-15T10:00'),
      ev('b', '2026-10-15T09:30', '2026-10-15T11:00'),
      ev('c', '2026-10-15T10:00', '2026-10-15T10:30'),
      ev('d', '2026-10-15T13:00', '2026-10-15T14:00'),
    ];
    const out = Object.fromEntries(layoutDay(items, d('2026-10-15T00:00')).map((p) => [p.item.id, p]));
    expect(out.a).toMatchObject({ top: 540, height: 60, column: 0, columns: 2 });
    expect(out.b).toMatchObject({ column: 1, columns: 2 });
    expect(out.c).toMatchObject({ column: 0, columns: 2 });
    expect(out.d).toMatchObject({ column: 0, columns: 1 });
  });
  it('clips events that cross midnight and skips all-day events', () => {
    const items = [
      ev('late', '2026-10-15T23:00', '2026-10-16T02:00'),
      ev('all', '2026-10-15T00:00', '2026-10-16T00:00', true),
    ];
    const out = layoutDay(items, d('2026-10-15T00:00'));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ top: 1380, height: 60 });
  });
});
