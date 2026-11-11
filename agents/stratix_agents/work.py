"""الموظفين بيشتغلوا على المهام المفتوحة فعلًا ويسلّموا الناتج.

أي مهمة (من الاجتماع أو من رئيس مجلس الإدارة في الشات، زي "ابعتلي تقرير الحسابات")
الموظف المسؤول بيشتغل عليها في أول تشغيل: بيكتب الناتج من الأرقام الحقيقية اللي عنده
بس، والناتج بيتحفظ في المهمة نفسها وبيظهر في اللوحة وفي التقرير اليومي.
"""

from __future__ import annotations

from datetime import datetime, timezone

from .agent import AgentInactive
from .router import AllModelsUnavailable
from .runtime import Company

MAX_TASKS_PER_RUN = 10


def do_open_tasks(company: Company, facts: dict[str, str], limit: int = MAX_TASKS_PER_RUN) -> int:
    store = company.store
    roster = company.roster()
    open_tasks = [t for t in store.select("tasks") if t.get("status") in ("todo", "doing")]
    open_tasks.sort(key=lambda t: t.get("created_at") or "")
    done = 0
    for task in open_tasks[:limit]:
        agent = roster.get(task.get("agent_id"))
        if agent is None:
            continue
        my_facts = facts.get(agent.spec.id) or facts.get(agent.spec.department) or "مفيش أرقام عن شغلك في التشغيل ده."
        try:
            reply = agent.think(
                f"عندك مهمة مطلوب تسلّمها دلوقتي:\n«{task['title']}»\n{task.get('details') or ''}\n\n"
                f"الأرقام والبيانات الحقيقية اللي عندك (استخدمها بس، ماتألّفش غيرها):\n{my_facts}\n"
                f"وأرقام الشركة العامة: {facts.get('_company', '')}\n\n"
                "سلّم الناتج كامل في \"say\" باللغة العربية الفصحى وبأسلوب تقرير مهني موجّه لرئيس مجلس الإدارة"
                " (فقرة افتتاحية قصيرة ثم نقاط واضحة، من غير عامية ومن غير رموز)."
                " لو حاجة مطلوبة مش في البيانات اللي عندك أو مش في صلاحياتك، اذكر بوضوح ما هو الناقص."
            )
        except (AllModelsUnavailable, AgentInactive):
            continue
        store.update("tasks", {
            "status": "done",
            "result": reply["say"][:8000],
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }, id=task["id"])
        agent.log(f"خلّصت مهمة: {task['title']}")
        done += 1
    return done
