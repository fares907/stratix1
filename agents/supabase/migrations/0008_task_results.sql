-- ناتج المهمة (التقرير أو الشغل اللي الموظف سلّمه) ووقت ما خلّصها
alter table tasks add column if not exists result text;
alter table tasks add column if not exists completed_at timestamptz;
