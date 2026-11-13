-- التقرير اليومي في ميعاده: سيرفرنا بيطلب تشغيلة «report» من GitHub الساعة 4:40 و5:40 العصر بتوقيت القاهرة
-- (بعد اجتماع آخر اليوم)، بدل ما نستنى جدول GitHub اللي بيتأخر ساعات. التشغيلة بتعيد كتابة تقرير النهارده
-- فتكرارها آمن. محتاج سر GITHUB_DISPATCH_TOKEN في Vault (توكن GitHub صلاحيته Actions على الريبو ده بس)؛
-- من غيره الطلب بيترفض ومابيحصلش حاجة.
select cron.unschedule(jobid) from cron.job where jobname = 'daily-report';
select cron.schedule(
  'daily-report',
  '40 14,15 * * *',
  $$
  select net.http_post(
    url := 'https://api.github.com/repos/fares907/stratix1/actions/workflows/agents.yml/dispatches',
    headers := jsonb_build_object(
      'Accept', 'application/vnd.github+json',
      'User-Agent', 'stratix-clock',
      'Authorization', 'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'GITHUB_DISPATCH_TOKEN'), '')
    ),
    body := '{"ref":"main","inputs":{"run":"report"}}'::jsonb
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'GITHUB_DISPATCH_TOKEN');
  $$
);
