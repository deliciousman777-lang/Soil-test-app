-- SoilNote shared database schema (Supabase / PostgreSQL)
-- Authenticated users only. Frontend uses a publishable key + RLS.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='soilnote_member_role') then
    create type public.soilnote_member_role as enum ('owner','member');
  end if;
end $$;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  join_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists workspaces_created_by_idx
  on public.workspaces(created_by) where created_by is not null;

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.soilnote_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx
  on public.workspace_members(user_id, workspace_id);

create table if not exists public.projects (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  primary key (workspace_id, project_id)
);

create index if not exists projects_workspace_updated_idx
  on public.projects(workspace_id, updated_at desc);
create index if not exists projects_updated_by_idx
  on public.projects(updated_by) where updated_by is not null;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;

-- Private helpers. These are intentionally kept out of the exposed public schema.
create or replace function private.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
  );
$$;

create or replace function private.create_workspace_impl(p_name text)
returns table(workspace_id uuid, join_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
  v_code text;
  v_name text := trim(coalesce(p_name,''));
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 100 then
    raise exception 'Workspace name must be 1 to 100 characters';
  end if;

  insert into public.workspaces(name, created_by)
  values (v_name, v_user)
  returning id, public.workspaces.join_code into v_id, v_code;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (v_id, v_user, 'owner');

  return query select v_id, v_code;
end;
$$;

create or replace function private.join_workspace_impl(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
  v_code text := upper(trim(coalesce(p_code,'')));
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if v_code !~ '^[0-9A-F]{8}$' then
    raise exception 'Invalid join code';
  end if;

  select w.id into v_id
  from public.workspaces w
  where w.join_code = v_code;

  if v_id is null then
    raise exception 'Invalid join code';
  end if;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (v_id, v_user, 'member')
  on conflict (workspace_id, user_id) do nothing;

  return v_id;
end;
$$;

-- Public RPC wrappers remain SECURITY INVOKER. Privileged logic stays private.
create or replace function public.create_workspace(p_name text)
returns table(workspace_id uuid, join_code text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_workspace_impl(p_name);
$$;

create or replace function public.join_workspace(p_code text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.join_workspace_impl(p_code);
$$;

-- RLS policies.
drop policy if exists "members can view workspaces" on public.workspaces;
create policy "members can view workspaces"
on public.workspaces for select
to authenticated
using (private.is_workspace_member(id));

drop policy if exists "members can view members" on public.workspace_members;
create policy "members can view members"
on public.workspace_members for select
to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists "members can view projects" on public.projects;
create policy "members can view projects"
on public.projects for select
to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists "members can insert projects" on public.projects;
create policy "members can insert projects"
on public.projects for insert
to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and updated_by = (select auth.uid())
);

drop policy if exists "members can update projects" on public.projects;
create policy "members can update projects"
on public.projects for update
to authenticated
using (private.is_workspace_member(workspace_id))
with check (
  private.is_workspace_member(workspace_id)
  and updated_by = (select auth.uid())
);

-- Explicit Data API grants: no anonymous data access and no unnecessary table privileges.
revoke all on public.workspaces, public.workspace_members, public.projects from anon;
revoke all on public.workspaces, public.workspace_members, public.projects from authenticated;
grant usage on schema public to authenticated;
grant usage on schema private to authenticated;
grant select on public.workspaces, public.workspace_members to authenticated;
grant select, insert, update on public.projects to authenticated;

revoke all on function private.is_workspace_member(uuid) from public, anon;
revoke all on function private.create_workspace_impl(text) from public, anon;
revoke all on function private.join_workspace_impl(text) from public, anon;
revoke all on function public.create_workspace(text) from public, anon;
revoke all on function public.join_workspace(text) from public, anon;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.create_workspace_impl(text) to authenticated;
grant execute on function private.join_workspace_impl(text) to authenticated;
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
