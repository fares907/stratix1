-- التقارير اليومية وفحوصات الموقع

create table if not exists daily_reports (
  id bigint generated always as identity primary key,
  report_date date not null unique,
  headline text not null,            -- سطر واحد للتليجرام
  body text not null,                -- التقرير كامل (markdown)
  numbers jsonb not null default '{}', -- الأرقام اللي الكود حسبها
  meeting_id bigint references meetings (id),
  created_at timestamptz not null default now()
);

create table if not exists site_checks (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('quick', 'full')),
  ok boolean not null,
  details jsonb not null default '[]',
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['daily_reports', 'site_checks'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists owner_all on %I', t);
    execute format('create policy owner_all on %I for all to authenticated
                    using (is_owner()) with check (is_owner())', t);
  end loop;
end $$;

alter publication supabase_realtime add table daily_reports, outreach_messages, tasks;

-- الأفكار اللي الموظفين بيقترحوها في الاجتماع، وقرار المدير التنفيذي فيها
create table if not exists proposals (
  id bigint generated always as identity primary key,
  meeting_id bigint not null references meetings (id),
  agent_id text not null references agents (id),
  message_id bigint references messages (id),
  idea text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  ceo_reason text,
  created_at timestamptz not null default now()
);
alter table proposals enable row level security;
drop policy if exists owner_all on proposals;
create policy owner_all on proposals for all to authenticated using (is_owner()) with check (is_owner());
alter publication supabase_realtime add table proposals;

-- إمتى اتبعت إشعار تليجرام بالموافقة (عشان مايتبعتش مرتين)
alter table approvals add column if not exists notified_at timestamptz;
