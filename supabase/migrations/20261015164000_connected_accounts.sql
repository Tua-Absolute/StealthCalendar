create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google','outlook')),
  email text not null,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  constraint accounts_user_provider_email_key unique (user_id, provider, email)
);
alter table public.accounts enable row level security;
create policy "own accounts" on public.accounts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- OAuth tokens. RLS is on with no policies, so only the server (service role) can read or write them.
create table public.account_tokens (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.account_tokens enable row level security;

alter table public.calendars
  add column account_id uuid references public.accounts(id) on delete cascade,
  add column writable boolean not null default true,
  add column last_synced_at timestamptz,
  add column sync_error text;
create index calendars_account_idx on public.calendars(account_id);
alter table public.calendars add constraint calendars_account_external_key unique (account_id, external_id);
