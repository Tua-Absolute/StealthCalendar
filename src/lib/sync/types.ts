export type Provider = 'google' | 'outlook';

export const PROVIDERS: Provider[] = ['google', 'outlook'];

export const PROVIDER_LABELS: Record<Provider, string> = {
  google: 'Google Calendar',
  outlook: 'Outlook',
};

export interface Tokens {
  accessToken: string;
  /** Some refreshes return a new refresh token (Microsoft rotates them); keep it when they do. */
  refreshToken?: string;
  expiresAt: Date;
}

export interface RemoteCalendar {
  id: string;
  name: string;
  color: string | null;
  writable: boolean;
  primary: boolean;
}

/** An event as the provider has it, already converted to instants. */
export interface RemoteEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start: Date;
  /** Exclusive; all-day events end at midnight after their last day. */
  end: Date;
  allDay: boolean;
}

/** What the app sends to create or update an event on the provider. */
export interface EventWrite {
  title: string;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
}

export interface SyncWindow {
  start: Date;
  end: Date;
}

export interface ProviderAdapter {
  authUrl(redirectUri: string, state: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<Tokens & { refreshToken: string; email: string }>;
  refresh(refreshToken: string): Promise<Tokens>;
  listCalendars(accessToken: string): Promise<RemoteCalendar[]>;
  listEvents(accessToken: string, calendarId: string, window: SyncWindow, tz: string): Promise<RemoteEvent[]>;
  createEvent(accessToken: string, calendarId: string, event: EventWrite, tz: string): Promise<RemoteEvent>;
  updateEvent(accessToken: string, calendarId: string, eventId: string, event: EventWrite, tz: string): Promise<RemoteEvent>;
  deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void>;
}

export class ProviderError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Sync covers six months back and eighteen months ahead. */
export function syncWindow(now = new Date()): SyncWindow {
  const day = 86_400_000;
  return { start: new Date(now.getTime() - 183 * day), end: new Date(now.getTime() + 548 * day) };
}
