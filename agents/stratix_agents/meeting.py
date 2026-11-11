"""الاجتماع اليومي.

1. كل موظف شغّال بيعرض شغله، مبني على أرقام حقيقية من قاعدة البيانات (facts).
2. الناقدة بتعترض وبتسمّي الموظفين اللي لازم يردّوا.
3. اللي اتسمّوا بيردّوا عليها (جولات لحد MAX_ROUNDS).
4. المدير التنفيذي بيقرر ويوزّع المهام، والقرار بيتسجل.

كل ده بيتكتب في جدول messages، فاللوحة بتعرضه لايف وهو بيحصل.
"""

from __future__ import annotations

from datetime import datetime, timezone

from .agent import Agent, AgentInactive
from .router import AllModelsUnavailable, Halted
from .runtime import Company

MAX_ROUNDS = 2
PAUSE_BETWEEN_SPEAKERS = 4.0  # ثواني بين كل موظف والتاني عشان نفضل جوه حد Groq في الدقيقة
MAX_REPLIES_PER_ROUND = 4


def chairman_notes(store, names: dict[str, str], limit: int = 15) -> str:
    """كل اللي رئيس مجلس الإدارة قاله لأي موظف في الشات: معلومات مؤكدة يعرفها الفريق كله."""
    said = [c for c in store.select("chats") if c.get("role") == "owner"]
    said.sort(key=lambda c: c.get("created_at") or "")
    if not said:
        return ""
    lines = "\n".join(f"- (قالها لـ{names.get(c['agent_id'], c['agent_id'])}) {c['content'][:400]}" for c in said[-limit:])
    return ("كلام رئيس مجلس الإدارة في الشات (معلومات مؤكدة منه شخصيًا، اعتمد عليها في الأرقام والقرارات):\n"
            f"{lines}\n")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_think(agent: Agent, prompt: str, **kw) -> dict | None:
    """موظف واحد وقع (مفيش موديل متاح) مايوقفش الاجتماع كله."""
    pause = getattr(agent.router, "_sleep", None)
    if pause and PAUSE_BETWEEN_SPEAKERS:
        pause(PAUSE_BETWEEN_SPEAKERS)
    try:
        return agent.think(prompt, **kw)
    except AllModelsUnavailable as exc:
        agent.log(f"ماقدرتش أشارك: {exc}", kind="error", meeting_id=kw.get("meeting_id"))
    except AgentInactive:
        pass
    return None


def run(company: Company, facts: dict[str, str], kind: str = "daily") -> int:
    roster = company.roster()
    ceo, critic = roster.get("ceo"), roster.get("critic")
    if ceo is None:
        raise RuntimeError("مفيش مدير تنفيذي شغّال — الاجتماع محتاج ceo")

    store = company.store
    meeting = store.insert("meetings", {"kind": kind, "status": "running"})
    mid = meeting["id"]
    transcript: list[str] = []

    try:
        pending = store.select("approvals", status="pending")
        open_tasks = [t for t in store.select("tasks") if t.get("status") in ("todo", "doing", "blocked")]
        # توجيهات رئيس مجلس الإدارة للمدير التنفيذي في الشات: ليها الأولوية في الاجتماع
        directives = [c["content"] for c in store.select("chats", agent_id="ceo") if c.get("role") == "owner"][-5:]
        directive_text = (
            "توجيهات رئيس مجلس الإدارة ليك في الشات (ليها الأولوية):\n- " + "\n- ".join(directives) + "\n"
            if directives else ""
        )
        notes = chairman_notes(store, {a.spec.id: a.spec.name for a in roster.values()})
        agenda = (
            f"الأرقام الحقيقية النهارده:\n{facts.get('_company', '')}\n"
            f"{notes}"
            f"موافقات مستنية رئيس مجلس الإدارة: {len(pending)}\n"
            f"مهام مفتوحة من الاجتماعات اللي فاتت: {len(open_tasks)}\n"
            f"{directive_text}"
        )
        opening = ceo.think(
            "افتح الاجتماع في سطرين: إيه أهم حاجة النهارده؟ لو فيه توجيهات من رئيس مجلس الإدارة ابدأ بيها.\n"
            f"{agenda}", meeting_id=mid
        )
        transcript.append(f"{ceo.spec.name} (المدير): {opening['say']}")

        # ── الجولة الأولى: كل واحد يعرض ويقترح ───────────────
        said: dict[str, dict] = {}
        proposals: list[dict] = []
        for agent in roster.values():
            if agent.spec.id in ("ceo", "critic"):
                continue
            my_tasks = [t["title"] for t in open_tasks if t.get("agent_id") == agent.spec.id]
            owner_said = [c["content"] for c in store.select("chats", agent_id=agent.spec.id)
                          if c.get("role") == "owner"][-3:]
            prompt = (
                f"المدير قال: {opening['say']}\n\n"
                f"الأرقام الحقيقية عن شغلك (ماتغيّرهاش وماتزودش عليها):\n"
                f"{facts.get(agent.spec.id) or facts.get(agent.spec.department) or 'مفيش بيانات عن شغلك لسه.'}\n"
                f"مهامك المفتوحة: {my_tasks or 'مفيش'}\n"
                + (f"رئيس مجلس الإدارة قالك مؤخرًا في الشات (خده في اعتبارك): {owner_said}\n" if owner_said else "")
                + notes
                + "\n"
                "اعرض شغلك في 3 سطور بالكتير: عملت إيه، فيه مشكلة إيه، ومحتاج إيه."
                " لو مفيش بيانات قول كده بصراحة.\n"
                "ولو عندك فكرة واحدة واقعية تخلي الشركة أحسن (في حدود القوانين والأدوات اللي عندك)"
                " حطها في \"proposal\" في JSON، أو سيبها فاضية."
            )
            reply = _safe_think(agent, prompt, meeting_id=mid, reply_to=opening["message_id"])
            if reply:
                said[agent.spec.id] = reply
                transcript.append(f"{agent.spec.name} ({agent.spec.title}): {reply['say']}")
                idea = str(reply.get("proposal") or "").strip()
                if idea:
                    row = store.insert("proposals", {
                        "meeting_id": mid, "agent_id": agent.spec.id,
                        "message_id": reply["message_id"], "idea": idea[:1000],
                    })
                    proposals.append(row)
                    transcript.append(f"  💡 فكرة #{row['id']} من {agent.spec.name}: {idea}")

        # ── جولات النقد ─────────────────────────────────────
        names = {a.spec.id: a.spec.name for a in roster.values()}
        for _round in range(MAX_ROUNDS if critic else 0):
            critique = _safe_think(
                critic,
                "ده الاجتماع لحد دلوقتي:\n" + "\n".join(transcript) + "\n\n"
                "اعترضي على أضعف النقط: معلومة مالهاش مصدر، وعد مش مسموح، خطة مش واقعية، أو حاجة اتنست."
                " وقيّمي كل فكرة (💡) بصراحة: تنفع ولا لأ وليه."
                f" وفي JSON زوّدي \"ask\": قائمة بأكواد الموظفين اللي لازم يردّوا (من دول: {list(names)})،"
                " وسيبيها فاضية لو مفيش اعتراض حقيقي.",
                meeting_id=mid,
            )
            if not critique:
                break
            transcript.append(f"{critic.spec.name} (الناقدة): {critique['say']}")
            store.update("messages", {"kind": "objection"}, id=critique["message_id"])
            asked = critique.get("ask") if isinstance(critique.get("ask"), list) else []
            asked = [a for a in asked if a in roster and a != "critic"][:MAX_REPLIES_PER_ROUND]
            if not asked:
                break
            for agent_id in asked:
                agent = roster[agent_id]
                reply = _safe_think(
                    agent,
                    f"الناقدة قالت: {critique['say']}\nرد عليها باختصار: موافق ولا لأ وليه، وهتعمل إيه.",
                    meeting_id=mid,
                    reply_to=critique["message_id"],
                )
                if reply:
                    transcript.append(f"{agent.spec.name}: {reply['say']}")

        # ── القرار ──────────────────────────────────────────
        decision = ceo.think(
            "ده الاجتماع كله:\n" + "\n".join(transcript) + "\n\n"
            + directive_text
            + "اقفل الاجتماع بقرار يحقق توجيهات رئيس مجلس الإدارة لو فيه. في JSON زوّد:\n"
            '"proposals": [{"id": رقم الفكرة, "decision": "approved" أو "rejected", "reason": ليه}]'
            " — قرار في كل فكرة 💡، ووافق بس على اللي يفيد الشركة فعلًا وفي حدود القوانين.\n"
            '"tasks": [{"agent_id": كود الموظف, "title": المهمة, "details": تفاصيل}] (من دول: '
            f"{list(names)})\n"
            '"feedback": [{"agent_id": كود الموظف, "note": ملاحظة صريحة على أداءه وإيه المطلوب منه}] '
            "(لو رئيس مجلس الإدارة اشتكى من موظف، لازم تدّيله ملاحظة واضحة وتعيد توزيع شغله في tasks).\n"
            '"needs_approval": [{"summary": إيه, "reason": ليه محتاج رئيس مجلس الإدارة}] '
            "(أي حاجة فيها فلوس برّا القوانين أو وعد أو قرار كبير).\n"
            "و\"say\" يبقى ملخص القرار في 5 سطور.",
            meeting_id=mid,
        )
        store.update("messages", {"kind": "decision"}, id=decision["message_id"])

        by_id = {p["id"]: p for p in proposals}
        for verdict in decision.get("proposals") if isinstance(decision.get("proposals"), list) else []:
            if not isinstance(verdict, dict):
                continue
            try:
                pid = int(verdict.get("id"))
            except (TypeError, ValueError):
                continue
            if pid in by_id and verdict.get("decision") in ("approved", "rejected"):
                reason = str(verdict.get("reason") or "")[:1000]
                store.update("proposals", {"status": verdict["decision"], "ceo_reason": reason}, id=pid)
                word = "وافقت على" if verdict["decision"] == "approved" else "رفضت"
                store.insert("messages", {
                    "agent_id": "ceo", "meeting_id": mid, "reply_to": by_id[pid].get("message_id"),
                    "kind": "decision", "content": f"{word} فكرة {names.get(by_id[pid]['agent_id'])}: {reason}",
                })
        # ملاحظات المدير لكل موظف: بتتسجل كمهمة مفتوحة، فالموظف بيشوفها ويرد عليها في الاجتماع الجاي
        for item in decision.get("feedback") if isinstance(decision.get("feedback"), list) else []:
            if isinstance(item, dict) and item.get("agent_id") in names and item.get("note"):
                note = str(item["note"])[:1500]
                store.insert("tasks", {
                    "agent_id": item["agent_id"], "meeting_id": mid,
                    "title": f"ملاحظة من المدير التنفيذي: {note[:250]}", "details": note, "status": "todo",
                })
                store.insert("messages", {
                    "agent_id": "ceo", "meeting_id": mid, "kind": "decision",
                    "content": f"ملاحظة لـ {names[item['agent_id']]}: {note}",
                })
        for task in decision.get("tasks") if isinstance(decision.get("tasks"), list) else []:
            if isinstance(task, dict) and task.get("agent_id") in names and task.get("title"):
                store.insert(
                    "tasks",
                    {
                        "agent_id": task["agent_id"],
                        "meeting_id": mid,
                        "title": str(task["title"])[:300],
                        "details": str(task.get("details") or "")[:2000],
                        "status": "todo",
                    },
                )
        for item in decision.get("needs_approval") if isinstance(decision.get("needs_approval"), list) else []:
            if isinstance(item, dict) and item.get("summary"):
                store.insert(
                    "approvals",
                    {
                        "agent_id": "ceo",
                        "kind": "decision",
                        "summary": str(item["summary"])[:300],
                        "payload": {"body": str(item.get("reason") or "")},
                        "reasons": ["قرار من الاجتماع محتاج موافقتك"],
                    },
                )
        store.update(
            "meetings", {"status": "done", "summary": decision["say"], "ended_at": _now()}, id=mid
        )
    except Halted:
        store.update("meetings", {"status": "failed", "summary": "اتوقف بزرار إيقاف الكل", "ended_at": _now()}, id=mid)
        raise
    except Exception as exc:
        store.update("meetings", {"status": "failed", "summary": f"وقع: {exc}", "ended_at": _now()}, id=mid)
        raise
    return mid
