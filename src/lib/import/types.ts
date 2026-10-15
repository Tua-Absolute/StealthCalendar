export interface ImportedEvent {
  /** Stable per source event (and per occurrence for repeating ones), so re-importing updates instead of duplicating. */
  uid: string;
  title: string;
  description: string | null;
  location: string | null;
  start: Date;
  /** Exclusive. All-day events end at midnight after their last day. */
  end: Date;
  allDay: boolean;
  category: string | null;
}

export interface ParsedFile {
  fileName: string;
  /** Name the file gives its calendar (X-WR-CALNAME), if any. */
  calendarName: string | null;
  events: ImportedEvent[];
  /** Repeating events are expanded within this window. */
  window: { start: Date; end: Date };
  warnings: string[];
}

/** FNV-1a, enough to make a stable id from an event's content. */
export function stableHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
