-- AI Career Copilot — initial schema
--
-- Design notes
-- ------------
-- Every user-owned table carries `user_id references auth.users(id)` and is
-- protected by row-level security, so a row is only ever reachable by the
-- person it belongs to. That is the authorization model: there is no
-- application-level ownership check to forget.
--
-- Each entity promotes the columns we filter, sort or join on, and keeps the
-- full validated record in a `data` jsonb column. The Zod schemas in
-- @job-ai/types are the source of truth for that payload's shape, so the
-- database does not duplicate ~80 column definitions that would then have to
-- be migrated in lockstep with the types.
--
-- API keys live in their own table with NO policies at all, which means the
-- anon and authenticated roles cannot read them under any circumstances. They
-- are reachable only through the service role, server-side.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  name        text not null default '',
  avatar_url  text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are self-readable"
  on public.profiles for select using (auth.uid() = id);
create policy "profiles are self-writable"
  on public.profiles for update using (auth.uid() = id);

/*
 * Create the profile row the moment a user signs in with Google, so the
 * application never has to special-case a missing profile.
 */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        name  = case when public.profiles.name = '' then excluded.name else public.profiles.name end,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Resumes
-- ---------------------------------------------------------------------------

create table if not exists public.resumes (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  label       text not null default 'My Resume',
  is_default  boolean not null default false,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists resumes_user_idx on public.resumes (user_id, updated_at desc);

-- One default resume per user; everything downstream reads that one.
create unique index if not exists resumes_one_default_idx
  on public.resumes (user_id) where is_default;

create table if not exists public.resume_versions (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  resume_id   text not null,
  job_id      text,
  name        text not null,
  kind        text not null default 'manual',
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists resume_versions_user_idx on public.resume_versions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Jobs & analyses
-- ---------------------------------------------------------------------------

create table if not exists public.jobs (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  fingerprint  text not null,
  title        text not null default '',
  company      text not null default '',
  url          text not null default '',
  data         jsonb not null,
  captured_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists jobs_user_idx on public.jobs (user_id, captured_at desc);

-- De-duplicates re-analysis of the same posting, per user.
create unique index if not exists jobs_user_fingerprint_idx
  on public.jobs (user_id, fingerprint) where fingerprint <> '';

create table if not exists public.analyses (
  id             text primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  job_id         text not null,
  resume_id      text not null,
  overall_score  integer not null default 0,
  mode           text not null default 'local',
  data           jsonb not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists analyses_user_job_idx on public.analyses (user_id, job_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------

create table if not exists public.applications (
  id             text primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  job_id         text not null,
  status         text not null default 'saved',
  company        text not null default '',
  title          text not null default '',
  match_score    integer,
  discovered_at  timestamptz not null default now(),
  applied_at     timestamptz,
  data           jsonb not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists applications_user_idx on public.applications (user_id, discovered_at desc);
create index if not exists applications_user_status_idx on public.applications (user_id, status);

-- A posting is tracked at most once per user.
create unique index if not exists applications_user_job_idx on public.applications (user_id, job_id);

-- ---------------------------------------------------------------------------
-- Generated artefacts
-- ---------------------------------------------------------------------------

create table if not exists public.cover_letters (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  job_id      text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists cover_letters_user_idx on public.cover_letters (user_id, created_at desc);

create table if not exists public.interview_preps (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  job_id          text not null,
  application_id  text,
  data            jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists interview_preps_user_idx on public.interview_preps (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

create table if not exists public.user_settings (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

/*
 * BYOK credentials.
 *
 * Deliberately separate from user_settings and deliberately WITHOUT policies:
 * with RLS enabled and no policy granting access, the anon and authenticated
 * roles are denied every operation. Only the service role — which exists solely
 * on the server — can read or write this table, so a leaked publishable key
 * cannot expose anyone's API key.
 */
create table if not exists public.ai_credentials (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  provider    text not null default 'openai',
  api_key     text not null default '',
  updated_at  timestamptz not null default now()
);

alter table public.ai_credentials enable row level security;
-- (No policies by design. Service-role access only.)

-- ---------------------------------------------------------------------------
-- Row-level security for the user-owned tables
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'resumes', 'resume_versions', 'jobs', 'analyses',
    'applications', 'cover_letters', 'interview_preps', 'user_settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy "%1$s owner can select" on public.%1$I for select using (auth.uid() = user_id)', t);
    execute format(
      'create policy "%1$s owner can insert" on public.%1$I for insert with check (auth.uid() = user_id)', t);
    execute format(
      'create policy "%1$s owner can update" on public.%1$I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format(
      'create policy "%1$s owner can delete" on public.%1$I for delete using (auth.uid() = user_id)', t);
  end loop;
end
$$;
