-- ساعة الشركة: pg_cron بينادي الـ edge function «company-clock» كل دقيقتين.
-- المواعيد بقت على Supabase نفسه (بالدقيقة) بدل جدول GitHub اللي بيتأخر ساعات.
-- السر بيتعمل عشوائي جوه Vault ومابيظهرش في الكود.

create extension if not exists pg_cron;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'CLOCK_SECRET') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'CLOCK_SECRET', 'company-clock caller secret');
  end if;
end $$;

select cron.unschedule(jobid) from cron.job where jobname = 'company-clock';
select cron.schedule(
  'company-clock',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://frpqnfygixxolvpseqox.supabase.co/functions/v1/company-clock',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-clock-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'CLOCK_SECRET')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);

-- مهام بنفس العنوان لنفس الموظف اتكررت من كذا اجتماع: نسيب الأحدث بس
update public.tasks t set status = 'done', completed_at = now(),
  result = 'اتدمجت مع مهمة أحدث بنفس العنوان (#' || newer.id || ').'
from public.tasks newer
where t.status in ('todo', 'doing') and newer.status in ('todo', 'doing')
  and newer.agent_id = t.agent_id and newer.title = t.title and newer.id > t.id;
