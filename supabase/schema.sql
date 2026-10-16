-- PCA Student Solution Portal — initial schema
-- Run this in Supabase SQL Editor AFTER creating your Supabase project.
-- Never put a service_role key in this frontend.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  student_id text unique not null check (student_id ~ '^2609[0-9]{3}$'),
  full_name text not null default 'Student',
  class_level text not null default '9',
  role text not null default 'student' check (role in ('student','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  class_level text not null default '9',
  subject text not null check (subject in ('Physics','Chemistry')),
  title text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(class_level, subject, title)
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(chapter_id, title)
);

create table if not exists public.solutions (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  question_number integer not null check (question_number > 0),
  title text not null,
  question_html text not null default '',
  solution_html text not null default '',
  status text not null default 'draft' check (status in ('draft','published','missing')),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(chapter_id, question_number)
);

create index if not exists solutions_question_number_idx on public.solutions(question_number);
create index if not exists solutions_status_idx on public.solutions(status);
create index if not exists topics_chapter_id_idx on public.topics(chapter_id);

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin' and active = true
  );
$$;

alter table public.profiles enable row level security;
alter table public.chapters enable row level security;
alter table public.topics enable row level security;
alter table public.solutions enable row level security;

drop policy if exists "Read own profile or admin" on public.profiles;
create policy "Read own profile or admin" on public.profiles
for select to authenticated
using (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Admin manages profiles" on public.profiles;
create policy "Admin manages profiles" on public.profiles
for all to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Authenticated users read active chapters" on public.chapters;
create policy "Authenticated users read active chapters" on public.chapters
for select to authenticated
using (active = true or public.current_user_is_admin());

drop policy if exists "Admin manages chapters" on public.chapters;
create policy "Admin manages chapters" on public.chapters
for all to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Authenticated users read topics" on public.topics;
create policy "Authenticated users read topics" on public.topics
for select to authenticated
using (true);

drop policy if exists "Admin manages topics" on public.topics;
create policy "Admin manages topics" on public.topics
for all to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Students read published solutions only" on public.solutions;
create policy "Students read published solutions only" on public.solutions
for select to authenticated
using (status = 'published' or public.current_user_is_admin());

drop policy if exists "Admin manages solutions" on public.solutions;
create policy "Admin manages solutions" on public.solutions
for all to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

-- SECURITY SETUP NOTES:
-- 1) Create the first auth user in Supabase Dashboard > Authentication > Users.
-- 2) Insert its profile as role='admin' using that user's UUID.
-- 3) Create student auth users only from the dashboard (self sign-up is not implemented).
-- 4) For each student, insert a profile row with their auth UUID and student_id.
-- 5) In Authentication settings, disable public sign-ups. Do not expose service_role key.
