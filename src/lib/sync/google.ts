import { form, requestJson } from './http';
import { dateInZone, zoneDate } from './tz';
import type { EventWrite, ProviderAdapter, RemoteCalendar, RemoteEvent, Tokens } from './types';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/calendar/v3';
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar'];

interface GoogleTime {
  date?: string;
  dateTime?: string;
}

export interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start: GoogleTime;
  end?: GoogleTime;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

function clientCreds() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error('Google sign-in is not set up yet (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are missing).');
  return { id, secret };
}

function toTokens(t: TokenResponse): Tokens {
  return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: new Date(Date.now() + t.expires_in * 1000) };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export function fromGoogle(e: GoogleEvent, tz: string): RemoteEvent | null {
  if (e.status === 'cancelled' || !e.start) return null;
  const allDay = !!e.start.date;
  const start = allDay ? dateInZone(e.start.date!, tz) : new Date(e.start.dateTime!);
  let end = e.end ? (e.end.date ? dateInZone(e.end.date, tz) : new Date(e.end.dateTime!)) : start;
  if (end < start) end = start;
  return {
    id: e.id,
    title: e.summary?.trim() || '(No title)',
    description: e.description?.trim() || null,
    location: e.location?.trim() || null,
    start,
    end,
    allDay,
  };
}

export function toGoogle(e: EventWrite, tz: string) {
  const time = (d: Date) => (e.allDay ? { date: zoneDate(d, tz), dateTime: null } : { dateTime: d.toISOString(), date: null });
  return {
    summary: e.title,
    description: e.description ?? '',
    location: e.location ?? '',
    start: time(e.start),
    end: time(e.end),
  };
}

export const google: ProviderAdapter = {
  authUrl(redirectUri, state) {
    const params = new URLSearchParams({
      client_id: clientCreds().id,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return `${AUTH_URL}?${params}`;
  },

  async exchangeCode(code, redirectUri) {
    const { id, secret } = clientCreds();
    const t = await requestJson<TokenResponse>(TOKEN_URL, {
      label: 'Google sign-in',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ code, client_id: id, client_secret: secret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    if (!t.refresh_token) throw new Error('Google did not grant offline access. Remove StealthCalendar from your Google account permissions and connect again.');
    const me = await requestJson<{ email: string }>('https://openidconnect.googleapis.com/v1/userinfo', {
      label: 'Google profile',
      headers: auth(t.access_token),
    });
    return { ...toTokens(t), refreshToken: t.refresh_token, email: me.email };
  },

  async refresh(refreshToken) {
    const { id, secret } = clientCreds();
    const t = await requestJson<TokenResponse>(TOKEN_URL, {
      label: 'Google token refresh',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ refresh_token: refreshToken, client_id: id, client_secret: secret, grant_type: 'refresh_token' }),
    });
    return toTokens(t);
  },

  async listCalendars(token) {
    const out: RemoteCalendar[] = [];
    let pageToken: string | undefined;
    do {
      const q = new URLSearchParams({ maxResults: '250', ...(pageToken ? { pageToken } : {}) });
      const page = await requestJson<{
        items: { id: string; summary: string; summaryOverride?: string; backgroundColor?: string; accessRole: string; primary?: boolean }[];
        nextPageToken?: string;
      }>(`${API}/users/me/calendarList?${q}`, { label: 'Google calendar list', headers: auth(token) });
      for (const c of page.items) {
        if (c.accessRole === 'freeBusyReader') continue;
        out.push({
          id: c.id,
          name: c.summaryOverride ?? c.summary,
          color: c.backgroundColor ?? null,
          writable: c.accessRole === 'owner' || c.accessRole === 'writer',
          primary: !!c.primary,
        });
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
    return out;
  },

  async listEvents(token, calendarId, window, tz) {
    const out: RemoteEvent[] = [];
    let pageToken: string | undefined;
    do {
      const q = new URLSearchParams({
        singleEvents: 'true',
        timeMin: window.start.toISOString(),
        timeMax: window.end.toISOString(),
        maxResults: '2500',
        ...(pageToken ? { pageToken } : {}),
      });
      const page = await requestJson<{ items: GoogleEvent[]; nextPageToken?: string }>(
        `${API}/calendars/${encodeURIComponent(calendarId)}/events?${q}`,
        { label: 'Google events', headers: auth(token) }
      );
      for (const item of page.items) {
        const e = fromGoogle(item, tz);
        if (e) out.push(e);
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
    return out;
  },

  async createEvent(token, calendarId, event, tz) {
    const created = await requestJson<GoogleEvent>(`${API}/calendars/${encodeURIComponent(calendarId)}/events`, {
      label: 'Creating the Google event',
      method: 'POST',
      headers: { ...auth(token), 'Content-Type': 'application/json' },
      // A new event needs no cleared fields, so drop the nulls PATCH uses to switch between date and dateTime.
      body: JSON.stringify(toGoogle(event, tz), (_k, v) => (v === null ? undefined : v)),
    });
    return fromGoogle(created, tz)!;
  },

  async updateEvent(token, calendarId, eventId, event, tz) {
    const updated = await requestJson<GoogleEvent>(
      `${API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        label: 'Updating the Google event',
        method: 'PATCH',
        headers: { ...auth(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(toGoogle(event, tz)),
      }
    );
    return fromGoogle(updated, tz)!;
  },

  async deleteEvent(token, calendarId, eventId) {
    try {
      await requestJson<void>(`${API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
        label: 'Deleting the Google event',
        method: 'DELETE',
        headers: auth(token),
      });
    } catch (err) {
      // Already gone on Google's side: that's what we wanted.
      if ((err as { status?: number }).status === 404 || (err as { status?: number }).status === 410) return;
      throw err;
    }
  },
};
