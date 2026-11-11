-- ملف الـ PDF الحقيقي للتقرير (base64)، بيتعمل بالمتصفح في تشغيلة آخر اليوم
alter table daily_reports add column if not exists pdf text;
