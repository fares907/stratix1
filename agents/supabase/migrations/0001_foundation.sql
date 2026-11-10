-- STRATIX agents — الأساس (المرحلة 1)
-- يتشغّل مرة واحدة من Supabase → SQL Editor.
--
-- الأمان: RLS مفعّل على كل جدول. اللوحة بتدخل بحساب Supabase Auth بتاعك،
-- واللي مسموح لهم بس هم اللي في جدول owners. الـ agents بيستخدموا
-- service_role (بيتخطى RLS) من GitHub Actions بس.

create table if not exists owners (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from owners where user_id = auth.uid());
$$;

-- ── حالة الشركة (زرار إيقاف الكل) ───────────────────────────
create table if not exists system_state (
  id int primary key default 1 check (id = 1),
  halted boolean not null default false,
  halted_reason text,
  updated_at timestamptz not null default now()
);
insert into system_state (id) values (1) on conflict do nothing;

-- ── الموظفين ────────────────────────────────────────────────
create table if not exists agents (
  id text primary key,
  name text not null,
  title text not null,
  department text not null,
  status text not null default 'active'
    check (status in ('active', 'paused', 'fired')),
  primary_model text not null,
  fallback_model text not null,
  tools text[] not null default '{}',
  duties text[] not null default '{}',
  instructions text not null default '',
  sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- كل تعديل في موظف بيتسجل (مين اتغيّر، إيه اللي اتغيّر، إمتى)
create table if not exists agent_revisions (
  id bigint generated always as identity primary key,
  agent_id text not null references agents (id) on delete cascade,
  before jsonb,
  after jsonb not null,
  changed_at timestamptz not null default now()
);

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- after: الصف لازم يكون اتحفظ الأول عشان الـ foreign key
create or replace function log_agent_revision() returns trigger
language plpgsql as $$
begin
  insert into agent_revisions (agent_id, before, after)
  values (new.id, case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  return null;
end $$;

drop trigger if exists agents_touch on agents;
create trigger agents_touch before update on agents
  for each row execute function touch_updated_at();

drop trigger if exists agents_revision on agents;
create trigger agents_revision after insert or update on agents
  for each row execute function log_agent_revision();

-- ── الاجتماعات والرسايل (غرفة الاجتماعات) ─────────────────────
create table if not exists meetings (
  id bigint generated always as identity primary key,
  kind text not null default 'daily',
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  summary text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists messages (
  id bigint generated always as identity primary key,
  agent_id text references agents (id),
  meeting_id bigint references meetings (id),
  reply_to bigint references messages (id),
  kind text not null default 'speech'
    check (kind in ('speech', 'objection', 'decision', 'activity', 'error')),
  content text not null,
  reasoning text,
  confidence text check (confidence in ('high', 'medium', 'low')),
  unknowns text[],
  model_key text,
  used_fallback boolean,
  created_at timestamptz not null default now()
);
create index if not exists messages_meeting_idx on messages (meeting_id, created_at);
create index if not exists messages_created_idx on messages (created_at desc);

-- ── المهام والموافقات ───────────────────────────────────────
create table if not exists tasks (
  id bigint generated always as identity primary key,
  agent_id text not null references agents (id),
  meeting_id bigint references meetings (id),
  title text not null,
  details text,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done', 'blocked')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists approvals (
  id bigint generated always as identity primary key,
  agent_id text not null references agents (id),
  kind text not null,            -- message / price / merge_pr / ...
  summary text not null,
  payload jsonb not null,        -- اللي هيتنفّذ لو وافقت (وتقدر تعدّله)
  reasons text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'executed', 'failed')),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
create index if not exists approvals_pending_idx on approvals (status) where status = 'pending';

-- ── استهلاك الموديلات ──────────────────────────────────────
create table if not exists llm_calls (
  id bigint generated always as identity primary key,
  agent_id text not null,
  provider text not null,
  model_key text not null,
  model_id text not null,
  is_fallback boolean not null default false,
  status text not null,
  latency_ms int,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists llm_calls_day_idx on llm_calls (created_at, model_key);

-- المحاولات اللي المزوّد رفضها قبل ما يحسبها مابتتعدّش، والباقي بيتعدّ
create or replace function llm_usage_for_day(day date)
returns table (model_key text, calls bigint) language sql stable as $$
  select model_key, count(*) from llm_calls
  where created_at >= day and created_at < day + 1
    and status not in ('network_error')
  group by model_key;
$$;

-- ── المبيعات ───────────────────────────────────────────────
create table if not exists leads (
  id bigint generated always as identity primary key,
  osm_id text unique,
  name text not null,
  category text,
  city text,
  address text,
  phone text,
  email text,
  social_url text,
  lat double precision,
  lon double precision,
  source text not null default 'openstreetmap',
  status text not null default 'new'
    check (status in ('new', 'qualified', 'rejected', 'contacted', 'replied',
                      'interested', 'won', 'lost', 'unsubscribed')),
  priority int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists outreach_messages (
  id bigint generated always as identity primary key,
  lead_id bigint not null references leads (id),
  agent_id text not null references agents (id),
  channel text not null,
  direction text not null check (direction in ('out', 'in')),
  subject text,
  body text not null,
  status text not null default 'draft'
    check (status in ('draft', 'held', 'sent', 'failed', 'received')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- أي حد يلغي الاشتراك مابنكلموش تاني أبدًا
create table if not exists suppression_list (
  contact text primary key,      -- إيميل أو رقم، بعد التوحيد
  reason text not null default 'unsubscribed',
  created_at timestamptz not null default now()
);

-- ── RLS ────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['owners','system_state','agents','agent_revisions','meetings',
    'messages','tasks','approvals','llm_calls','leads','outreach_messages','suppression_list']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists owner_all on %I', t);
    execute format('create policy owner_all on %I for all to authenticated
                    using (is_owner()) with check (is_owner())', t);
  end loop;
end $$;

-- ── Realtime (التحديث اللايف في اللوحة) ─────────────────────
alter publication supabase_realtime add table messages, approvals, agents, system_state, meetings;
