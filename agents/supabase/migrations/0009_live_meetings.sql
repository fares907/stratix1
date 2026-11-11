-- الاجتماع اللايف: رئيس مجلس الإدارة بيتكلم مع الفريق كله
alter table messages add column if not exists author text check (author in ('chairman'));
alter table meetings add column if not exists topic text;
alter table meetings add column if not exists ends_at timestamptz;
