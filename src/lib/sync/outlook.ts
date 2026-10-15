import { form, requestJson } from './http';
import { dateInZone, zoneDate } from './tz';
import type { EventWrite, ProviderAdapter, RemoteCalendar, RemoteEvent, Tokens } from './types';

const AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPES = ['offline_access', 'User.Read', 'Calendars.ReadWrite'];

interface GraphTime {
  dateTime: string;
  timeZone: string;
}

export interface GraphEvent {
  id: string;
  subject?: string;
  bodyPreview?: string;
  body?: { contentType: string; content: string };
  location?: { displayName?: string };
  start: GraphTime;
  end: GraphTime;
  isAllDay?: boolean;
  isCancelled?: boolean;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

function clientCreds() {
  const id = process.env.MICROSOFT_CLIENT_ID;
  const secret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!id || !secret) throw new Error('Outlook sign-in is not set up yet (MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET are missing).');
  return { id, secret };
}

function toTokens(t: TokenResponse): Tokens {
  return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: new Date(Date.now() + t.expires_in * 1000) };
}

// Ask Graph for times in UTC and plain-text bodies, so nothing depends on the mailbox's settings.
const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Prefer: 'outlook.timezone="UTC", outlook.body-content-type="text"',
});

/** Graph's dateTime has no offset; with the UTC preference above it is UTC. */
function utc(t: GraphTime): Date {
  const s = t.dateTime.replace(/\.\d+$/, '');
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : `${s}Z`);
}

export function fromGraph(e: GraphEvent, tz: string): RemoteEvent | null {
  if (e.isCancelled) return null;
  const allDay = !!e.isAllDay;
  // All-day events are whole calendar days; Graph reports them as midnight dates.
  const start = allDay ? dateInZone(e.start.dateTime, tz) : utc(e.start);
  let end = allDay ? dateInZone(e.end.dateTime, tz) : utc(e.end);
  if (end < start) end = start;
  const description = (e.body?.content ?? e.bodyPreview ?? '').trim();
  return {
    id: e.id,
    title: e.subject?.trim() || '(No title)',
    description: description || null,
    location: e.location?.displayName?.trim() || null,
    start,
    end,
    allDay,
  };
}

export function toGraph(e: EventWrite, tz: string) {
  const time = (d: Date) =>
    e.allDay
      ? { dateTime: `${zoneDate(d, tz)}T00:00:00`, timeZone: tz }
      : { dateTime: d.toISOString().replace('Z', ''), timeZone: 'UTC' };
  return {
    subject: e.title,
    body: { contentType: 'text', content: e.description ?? '' },
    location: { displayName: e.location ?? '' },
    isAllDay: e.allDay,
    start: time(e.start),
    end: time(e.end),
  };
}

export const outlook: ProviderAdapter = {
  authUrl(redirectUri, state) {
    const params = new URLSearchParams({
      client_id: clientCreds().id,
      redirect_uri: redirectUri,
      response_type: 'code',
      response_mode: 'query',
      scope: SCOPES.join(' '),
      prompt: 'select_account',
      state,
    });
    return `${AUTHORITY}/authorize?${params}`;
  },

  async exchangeCode(code, redirectUri) {
    const { id, secret } = clientCreds();
    const t = await requestJson<TokenResponse>(`${AUTHORITY}/token`, {
      label: 'Microsoft sign-in',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ code, client_id: id, client_secret: secret, redirect_uri: redirectUri, grant_type: 'authorization_code', scope: SCOPES.join(' ') }),
    });
    if (!t.refresh_token) throw new Error('Microsoft did not grant offline access. Try connecting again.');
    const me = await requestJson<{ mail?: string; userPrincipalName: string }>(`${GRAPH}/me`, {
      label: 'Microsoft profile',
      headers: headers(t.access_token),
    });
    return { ...toTokens(t), refreshToken: t.refresh_token, email: me.mail ?? me.userPrincipalName };
  },

  async refresh(refreshToken) {
    const { id, secret } = clientCreds();
    const t = await requestJson<TokenResponse>(`${AUTHORITY}/token`, {
      label: 'Microsoft token refresh',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ refresh_token: refreshToken, client_id: id, client_secret: secret, grant_type: 'refresh_token', scope: SCOPES.join(' ') }),
    });
    return toTokens(t);
  },

  async listCalendars(token) {
    const out: RemoteCalendar[] = [];
    let url: string | undefined = `${GRAPH}/me/calendars?$top=100&$select=id,name,hexColor,canEdit,isDefaultCalendar`;
    while (url) {
      const page: { value: { id: string; name: string; hexColor?: string; canEdit: boolean; isDefaultCalendar?: boolean }[]; '@odata.nextLink'?: string } =
        await requestJson(url, { label: 'Outlook calendar list', headers: headers(token) });
      for (const c of page.value) {
        out.push({ id: c.id, name: c.name, color: c.hexColor || null, writable: c.canEdit, primary: !!c.isDefaultCalendar });
      }
      url = page['@odata.nextLink'];
    }
    return out;
  },

  async listEvents(token, calendarId, window, tz) {
    const out: RemoteEvent[] = [];
    const q = new URLSearchParams({
      startDateTime: window.start.toISOString(),
      endDateTime: window.end.toISOString(),
      $top: '500',
      $select: 'id,subject,body,location,start,end,isAllDay,isCancelled',
    });
    let url: string | undefined = `${GRAPH}/me/calendars/${encodeURIComponent(calendarId)}/calendarView?${q}`;
    while (url) {
      const page: { value: GraphEvent[]; '@odata.nextLink'?: string } = await requestJson(url, { label: 'Outlook events', headers: headers(token) });
      for (const item of page.value) {
        const e = fromGraph(item, tz);
        if (e) out.push(e);
      }
      url = page['@odata.nextLink'];
    }
    return out;
  },

  async createEvent(token, calendarId, event, tz) {
    const created = await requestJson<GraphEvent>(`${GRAPH}/me/calendars/${encodeURIComponent(calendarId)}/events`, {
      label: 'Creating the Outlook event',
      method: 'POST',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(toGraph(event, tz)),
    });
    return fromGraph(created, tz)!;
  },

  async updateEvent(token, _calendarId, eventId, event, tz) {
    const updated = await requestJson<GraphEvent>(`${GRAPH}/me/events/${encodeURIComponent(eventId)}`, {
      label: 'Updating the Outlook event',
      method: 'PATCH',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(toGraph(event, tz)),
    });
    return fromGraph(updated, tz)!;
  },

  async deleteEvent(token, _calendarId, eventId) {
    try {
      await requestJson<void>(`${GRAPH}/me/events/${encodeURIComponent(eventId)}`, {
        label: 'Deleting the Outlook event',
        method: 'DELETE',
        headers: headers(token),
      });
    } catch (err) {
      if ((err as { status?: number }).status === 404) return;
      throw err;
    }
  },
};
