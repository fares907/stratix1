-- الكلام المباشر بين رئيس مجلس الإدارة وأي موظف من اللوحة

create table if not exists chats (
  id bigint generated always as identity primary key,
  agent_id text not null references agents (id) on delete cascade,
  role text not null check (role in ('owner', 'agent')),
  content text not null,
  model_key text,
  created_at timestamptz not null default now()
);
create index if not exists chats_agent_idx on chats (agent_id, created_at);

-- إعدادات الشركة (القوانين) عشان اللوحة تقراها؛ أمر seed بيحدّثها من rules.yaml
create table if not exists company_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- عنوان المزوّد، عشان اللوحة تكلّم الموديل مباشرة في الشات
alter table model_catalog add column if not exists base_url text;

do $$
declare t text;
begin
  foreach t in array array['chats', 'company_settings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists owner_all on %I', t);
    execute format('create policy owner_all on %I for all to authenticated
                    using (is_owner()) with check (is_owner())', t);
  end loop;
end $$;

alter publication supabase_realtime add table chats;
