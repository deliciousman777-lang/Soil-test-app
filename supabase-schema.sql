-- SoilNote shared database schema (Supabase / PostgreSQL)
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.projects (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (workspace_id, project_id)
);

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.create_workspace(p_name text)
returns table(workspace_id uuid, join_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.workspaces(name, created_by)
  values (trim(p_name), auth.uid())
  returning id, workspaces.join_code into v_id, v_code;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (v_id, auth.uid(), 'owner');

  return query select v_id, v_code;
end;
$$;

create or replace function public.join_workspace(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_id
  from public.workspaces
  where join_code = upper(trim(p_code));

  if v_id is null then
    raise exception 'Invalid join code';
  end if;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (v_id, auth.uid(), 'member')
  on conflict do nothing;

  return v_id;
end;
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;

-- Workspaces
create policy "members can view workspaces"
on public.workspaces for select
to authenticated
using (public.is_workspace_member(id));

-- Workspace members
create policy "members can view members"
on public.workspace_members for select
to authenticated
using (public.is_workspace_member(workspace_id));

-- Projects
create policy "members can view projects"
on public.projects for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "members can insert projects"
on public.projects for insert
to authenticated
with check (public.is_workspace_member(workspace_id) and updated_by = auth.uid());

create policy "members can update projects"
on public.projects for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id) and updated_by = auth.uid());

create policy "members can delete projects"
on public.projects for delete
to authenticated
using (public.is_workspace_member(workspace_id));

grant usage on schema public to authenticated;
grant select on public.workspaces, public.workspace_members to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.join_workspace(text) to authenticated;

-- Enable realtime for shared project updates.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'projects'
  ) then
    alter publication supabase_realtime add table public.projects;
  end if;
end $$;
