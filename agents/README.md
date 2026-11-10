# فريق STRATIX من الـ AI agents

15 موظف AI بيديروا الشغل اليومي للشركة، وانت رئيس مجلس الإدارة.

## اللي موجود دلوقتي (المرحلة 1، الجزء الأول)

| الملف | وظيفته |
|---|---|
| `config/team.yaml` | الـ 15 موظف: الاسم والدور والموديل الأساسي والاحتياطي والصلاحيات |
| `config/providers.yaml` | المزوّدين المجانيين وحدودهم (Gemini وGroq وCerebras وOpenRouter) |
| `config/rules.yaml` | قوانين الشركة: الأسعار (2000–3000 جنيه)، بنها، الأمانة، الحد اليومي |
| `stratix_agents/router.py` | بيختار الموديل، ولو الحد خلص أو حصل 429 يتحوّل للاحتياطي أوتوماتيك |
| `stratix_agents/agent.py` | الموظف: بيتأكد إنه مش موقوف، وبيتأكد من صلاحياته، وبيسجّل كل كلامه |
| `stratix_agents/guard.py` | فلتر بيمسك أي رسالة فيها سعر برّا الحدود أو ميعاد تسليم أو خصم |
| `stratix_agents/scout.py` | الكشّاف: محلات ومطاعم في بنها مالهاش موقع (من OpenStreetMap) |
| `supabase/migrations/` | قاعدة البيانات كاملة مع الحماية (RLS) والتحديث اللايف |

## قواعد ثابتة في الكود (مش في الـ prompt بس)

- **إيقاف الكل:** لو `system_state.halted` بقت true، أي طلب للموديل وأي أداة بتقف. ولو قاعدة البيانات مش بترد، الكود بيعتبر الشركة واقفة برضه.
- **الصلاحيات:** أي agent يحاول يستخدم أداة مش في قائمته الكود بيرفض.
- **البيانات الحساسة** (عملاء وفلوس) مابتروحش لمزوّد بيستخدم بيانات الخطة المجانية في التدريب.
- **كل موظف** ليه موديل أساسي وموديل احتياطي من مزوّد مختلف.

## التشغيل لأول مرة

1. اعمل مشروع على [Supabase](https://supabase.com). من **SQL Editor** شغّل `supabase/migrations/0001_foundation.sql` مرة واحدة.
2. من **Authentication** اعمل حساب لنفسك. بعدها في SQL Editor شغّل:
   `insert into owners (user_id) select id from auth.users where email = 'إيميلك';`
3. هات مفاتيح مجانية من Gemini وGroq وCerebras وOpenRouter (الروابط في `.env.example`).
4. في GitHub افتح **Settings → Secrets and variables → Actions** وضيف كل القيم اللي في `.env.example`.
5. من **Actions → Agents → Run workflow** شغّله مرة. هيعمل seed للفريق ويشغّل الكشّاف.

## على جهازك (اختياري)

```bash
cd agents
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest -q                 # الاختبارات
python -m stratix_agents check      # يعرض الفريق
python -m stratix_agents models     # يتأكد إن أسماء الموديلات لسه موجودة عند المزوّدين
```

## الجاي

1. لوحة التحكم (Next.js): غرفة الاجتماعات لايف، وإدارة الموظفين، وزرار إيقاف الكل، والموافقات.
2. المؤهِّل والكاتبة والإرسال، بعد ما نحدد قناة التواصل.
3. الاجتماع اليومي والتقرير.
4. فريق الموقع والأمان، والمالية، وفريق التطوير.
