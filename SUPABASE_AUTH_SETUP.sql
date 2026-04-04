-- Run this in Supabase SQL editor to support Google login profile sync.

create table if not exists public.profiles (
  id uuid primary key,
  email text unique not null,
  username text unique,
  full_name text,
  avatar_url text,
  phone text,
  date_of_birth date,
  bio text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  country text,
  preferred_category text,
  notification_email boolean default true,
  notification_sms boolean default false,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  auth_provider text,
  password_hash text,
  user_metadata jsonb,
  app_metadata jsonb,
  identities jsonb,
  raw_user_payload jsonb,
  provider text default 'google',
  last_login_at timestamptz,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- For local email/password accounts, profiles.id must not be forced to exist in auth.users.
alter table public.profiles drop constraint if exists profiles_id_fkey;

do $$
declare
  fk_name text;
begin
  for fk_name in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where c.contype = 'f'
      and n.nspname = 'public'
      and t.relname = 'profiles'
      and pg_get_constraintdef(c.oid) ilike '%references auth.users%'
  loop
    execute format('alter table public.profiles drop constraint if exists %I', fk_name);
  end loop;
end $$;

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists address_line_1 text;
alter table public.profiles add column if not exists address_line_2 text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists state text;
alter table public.profiles add column if not exists postal_code text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists preferred_category text;
alter table public.profiles add column if not exists notification_email boolean default true;
alter table public.profiles add column if not exists notification_sms boolean default false;
alter table public.profiles add column if not exists email_confirmed_at timestamptz;
alter table public.profiles add column if not exists last_sign_in_at timestamptz;
alter table public.profiles add column if not exists auth_provider text;
alter table public.profiles add column if not exists password_hash text;
alter table public.profiles add column if not exists user_metadata jsonb;
alter table public.profiles add column if not exists app_metadata jsonb;
alter table public.profiles add column if not exists identities jsonb;
alter table public.profiles add column if not exists raw_user_payload jsonb;
create unique index if not exists profiles_username_idx on public.profiles (username);

create table if not exists public.login_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  email text not null,
  provider text,
  full_name text,
  username text,
  avatar_url text,
  phone text,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  auth_provider text,
  user_metadata jsonb,
  app_metadata jsonb,
  raw_login_payload jsonb,
  logged_in_at timestamptz default now()
);

alter table public.login_audit add column if not exists full_name text;
alter table public.login_audit add column if not exists username text;
alter table public.login_audit add column if not exists avatar_url text;
alter table public.login_audit add column if not exists phone text;
alter table public.login_audit add column if not exists email_confirmed_at timestamptz;
alter table public.login_audit add column if not exists last_sign_in_at timestamptz;
alter table public.login_audit add column if not exists auth_provider text;
alter table public.login_audit add column if not exists user_metadata jsonb;
alter table public.login_audit add column if not exists app_metadata jsonb;
alter table public.login_audit add column if not exists raw_login_payload jsonb;

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at);

alter table public.profiles enable row level security;
alter table public.login_audit enable row level security;
alter table public.chat_messages enable row level security;

-- Service-role writes bypass RLS. Optional policies for authenticated reads.
drop policy if exists "profiles-select-own" on public.profiles;
create policy "profiles-select-own"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "profiles-insert-own" on public.profiles;
create policy "profiles-insert-own"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles-update-own" on public.profiles;
create policy "profiles-update-own"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "login-audit-select-own" on public.login_audit;
create policy "login-audit-select-own"
  on public.login_audit
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "login-audit-insert-own" on public.login_audit;
create policy "login-audit-insert-own"
  on public.login_audit
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "chat-messages-select-own" on public.chat_messages;
create policy "chat-messages-select-own"
  on public.chat_messages
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "chat-messages-insert-own" on public.chat_messages;
create policy "chat-messages-insert-own"
  on public.chat_messages
  for insert
  to authenticated
  with check (user_id = auth.uid());
