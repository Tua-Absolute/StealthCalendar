create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#ef4444',
  source text not null default 'local' check (source in ('local','ics','google','outlook')),
  external_id text,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
create index calendars_user_idx on public.calendars(user_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  title text not null,
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  color text,
  uid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_time_order check (end_at >= start_at)
);
create index events_user_start_idx on public.events(user_id, start_at);
create index events_calendar_idx on public.events(calendar_id);
create unique index events_calendar_uid_idx on public.events(calendar_id, uid) where uid is not null;

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

alter table public.calendars enable row level security;
alter table public.events enable row level security;

create policy "own calendars" on public.calendars for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own events" on public.events for all to authenticated
  using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.calendars c where c.id = calendar_id and c.user_id = (select auth.uid()))
  );
