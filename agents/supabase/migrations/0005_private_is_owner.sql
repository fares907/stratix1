-- is_owner() كانت في public، فكانت متاحة كـ RPC لأي حد عن طريق /rest/v1/rpc/is_owner.
-- بننقلها لـ schema "private" مش ظاهرة في الـ API، وبنحدّث كل الـ policies.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.owners where user_id = auth.uid());
$$;
revoke all on function private.is_owner() from public, anon;
grant execute on function private.is_owner() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['owners','system_state','agents','agent_revisions','meetings','messages',
    'tasks','approvals','llm_calls','leads','outreach_messages','suppression_list','model_catalog',
    'daily_reports','site_checks','proposals','chats','company_settings']
  loop
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated
                    using (private.is_owner()) with check (private.is_owner())', t);
  end loop;
end $$;

drop function if exists public.is_owner();
