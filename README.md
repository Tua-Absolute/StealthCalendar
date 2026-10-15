# StealthCalendar

A personal calendar manager and notifier in the Stealth black-and-red style.

## Stack

| Layer | Technology |
|---|---|
| App | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS with the Stealth dark-first theme |
| Data and sign-in | Supabase (Postgres with row-level security, email and password auth) |
| Client state | TanStack Query for data, Zustand for view and theme |
| Tests | Vitest |
| Hosting | Vercel |

## Features so far

- Month, week and day views, with keyboard shortcuts: `t` today, `m` / `w` / `d` views, arrow keys to move, `n` new event.
- Click any day or time slot to add an event; click an event to edit or delete it.
- Multiple calendars, each with its own color. Hide a calendar with its eye icon.
- Categories (like School or Work) color events across calendars. An event's own color wins, then its category's, then its calendar's.
- Import `.ics` files and Google or Outlook `.csv` exports by dropping them anywhere on the page or with the Import button.
  Repeating events are expanded from a year ago to two years ahead, time zones are converted to yours, and
  re-importing a file updates the events it added instead of duplicating them.
- Search event titles, locations and notes from the header (press `/`).
- Connect Google Calendar and Outlook accounts. Events sync both ways: changes made there show up here
  (on open, every 5 minutes, and with Sync now), and events you add, edit or delete here in a Google or
  Outlook calendar are written back. Sync covers six months back and eighteen months ahead.

## Google and Outlook setup

Sign-in redirects back to `https://<your-app>/api/connect/google/callback` and
`https://<your-app>/api/connect/outlook/callback`; register both with the providers, then set the
server variables listed in `.env.example` on Vercel. OAuth tokens live in `account_tokens`, which has
row-level security on and no policies, so only the server's service-role key can read them.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL and publishable key
npm run dev                  # http://localhost:3000
npm test
```

Set `ALLOWED_EMAILS` to your email to lock the app to your account.

## Database

`calendars`, `categories`, `events`, `accounts` and `account_tokens` live in Supabase. Every row belongs to a user and row-level security
means a signed-in user only ever sees their own rows. The schema is in `supabase/migrations/`.
