-- التقرير اليومي كمستند منظّم (ملخص بالفصحى، مؤشرات، جداول) عشان اللوحة تعرضه وتنزّله PDF
alter table daily_reports add column if not exists data jsonb not null default '{}';
