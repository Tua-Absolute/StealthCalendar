create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#a1a1aa',
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  constraint categories_user_name_key unique (user_id, name)
);
alter table public.categories enable row level security;
create policy "own categories" on public.categories for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.events add column category_id uuid references public.categories(id) on delete set null;
create index events_category_idx on public.events(category_id);

-- Imports upsert on (calendar_id, uid), which needs a real constraint rather than the partial index.
-- NULL uids stay distinct, so events made in the app are unaffected.
alter table public.events add constraint events_calendar_uid_key unique (calendar_id, uid);

alter policy "own events" on public.events
  using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.calendars c where c.id = calendar_id and c.user_id = (select auth.uid()))
    and (category_id is null or exists (
      select 1 from public.categories g where g.id = category_id and g.user_id = (select auth.uid())))
  );
