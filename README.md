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
- Multiple calendars, each with its own color, plus an optional color per event. Hide a calendar with its eye icon.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL and publishable key
npm run dev                  # http://localhost:3000
npm test
```

Set `ALLOWED_EMAILS` to your email to lock the app to your account.

## Database

`calendars` and `events` live in Supabase. Every row belongs to a user and row-level security
means a signed-in user only ever sees their own rows. The schema is in `supabase/migrations/`.
