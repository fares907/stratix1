-- قائمة الموديلات وحدودها، عشان لوحة التحكم تعرضها وتختار منها.
-- أمر seed بيملاها من config/providers.yaml في كل تشغيل.

create table if not exists model_catalog (
  key text primary key,            -- "groq:llama70b"
  provider text not null,
  model_id text not null,
  rpm int not null,
  rpd int not null,
  trains_on_free_data boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table model_catalog enable row level security;
drop policy if exists owner_all on model_catalog;
create policy owner_all on model_catalog for all to authenticated
  using (is_owner()) with check (is_owner());
