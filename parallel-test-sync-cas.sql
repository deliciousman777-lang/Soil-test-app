-- Additive CAS endpoint for concurrent independent trial edits.
-- No existing data is changed by this migration. Old clients remain callable;
-- every device must use the new endpoint before parallel work is enabled.
create or replace function soilnote_share.upsert_project_cas(
 p_code text,p_project_id text,p_payload jsonb,p_updated_at timestamptz,
 p_expect_exists boolean,p_expected_updated_at timestamptz,p_expected_deleted_at timestamptz,p_expected_payload jsonb
) returns boolean language plpgsql security definer set search_path='' as $$
declare
 v_workspace uuid;
 v_updated timestamptz:=coalesce(p_updated_at,now());
 v_count integer;
begin
 select w.id into v_workspace from soilnote_share.workspaces w
 where w.token_hash=extensions.digest(upper(regexp_replace(coalesce(p_code,''),'[^0-9A-F]','','g')),'sha256')
 limit 1;
 if v_workspace is null then raise exception 'invalid share code'; end if;
 if coalesce(p_project_id,'')='' or p_payload is null or jsonb_typeof(p_payload)<>'object' then
   raise exception 'invalid project payload';
 end if;
 if p_expect_exists then
   update soilnote_share.projects p set payload=p_payload,updated_at=greatest(v_updated,p.updated_at),deleted_at=null
   where p.workspace_id=v_workspace and p.project_id=p_project_id
     and p.updated_at is not distinct from p_expected_updated_at
     and p.deleted_at is not distinct from p_expected_deleted_at
     and p.payload is not distinct from p_expected_payload;
 else
   insert into soilnote_share.projects(workspace_id,project_id,payload,updated_at,deleted_at)
   values(v_workspace,p_project_id,p_payload,v_updated,null)
   on conflict(workspace_id,project_id) do nothing;
 end if;
 get diagnostics v_count=row_count;
 return v_count=1;
end;
$$;
revoke all on function soilnote_share.upsert_project_cas(text,text,jsonb,timestamptz,boolean,timestamptz,timestamptz,jsonb) from public;
grant usage on schema soilnote_share to anon,authenticated;
grant execute on function soilnote_share.upsert_project_cas(text,text,jsonb,timestamptz,boolean,timestamptz,timestamptz,jsonb) to anon,authenticated;
create or replace function public.soilnote_share_upsert_cas(
 p_code text,p_project_id text,p_payload jsonb,p_updated_at timestamptz,
 p_expect_exists boolean,p_expected_updated_at timestamptz,p_expected_deleted_at timestamptz,p_expected_payload jsonb
) returns boolean language sql security invoker set search_path='' as $$
 select soilnote_share.upsert_project_cas(p_code,p_project_id,p_payload,p_updated_at,p_expect_exists,p_expected_updated_at,p_expected_deleted_at,p_expected_payload)
$$;
revoke all on function public.soilnote_share_upsert_cas(text,text,jsonb,timestamptz,boolean,timestamptz,timestamptz,jsonb) from public;
grant execute on function public.soilnote_share_upsert_cas(text,text,jsonb,timestamptz,boolean,timestamptz,timestamptz,jsonb) to anon,authenticated;
