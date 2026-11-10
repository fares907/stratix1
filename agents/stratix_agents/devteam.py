"""فريق التطوير على GitHub.

- أحمد (developer): أي مشكلة حقيقية لقاها فريق الموقع بتتحول لـ Issue فيها
  التشخيص واقتراح الحل (من غير تكرار).
- رنا (reviewer): بتراجع الـ Pull Requests المفتوحة وتكتب تعليق واحد على كل PR.

مفيش أي agent يقدر يعمل merge: التوكن المطلوب صلاحياته issues + pull requests
(قراية وكتابة تعليقات) بس، والـ merge لـ main بيفضل قرارك انت.
"""

from __future__ import annotations

import httpx

from .router import AllModelsUnavailable
from .runtime import Company

API = "https://api.github.com"
LABEL = "agents"
REVIEW_MARK = "<!-- stratix-agents-review -->"
FOOTER = "\n\n---\n_اتكتب أوتوماتيك من فريق STRATIX (AI agents)._"


class GitHub:
    def __init__(self, token: str, repo: str, http: httpx.Client | None = None):
        self.repo = repo
        self.http = http or httpx.Client(timeout=30)
        self.headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}

    def _get(self, path: str, **params):
        r = self.http.get(f"{API}/repos/{self.repo}{path}", headers=self.headers, params=params)
        r.raise_for_status()
        return r

    def _post(self, path: str, body: dict):
        r = self.http.post(f"{API}/repos/{self.repo}{path}", headers=self.headers, json=body)
        r.raise_for_status()
        return r.json()

    def open_issue_titles(self) -> set[str]:
        return {i["title"] for i in self._get("/issues", state="open", labels=LABEL, per_page=100).json()}

    def create_issue(self, title: str, body: str) -> dict:
        return self._post("/issues", {"title": title, "body": body + FOOTER, "labels": [LABEL]})

    def open_pulls(self) -> list[dict]:
        return self._get("/pulls", state="open", per_page=20).json()

    def diff(self, number: int) -> str:
        r = self.http.get(f"{API}/repos/{self.repo}/pulls/{number}",
                          headers={**self.headers, "Accept": "application/vnd.github.diff"})
        r.raise_for_status()
        return r.text

    def comments(self, number: int) -> list[dict]:
        return self._get(f"/issues/{number}/comments", per_page=100).json()

    def comment(self, number: int, body: str) -> None:
        self._post(f"/issues/{number}/comments", {"body": body})


def file_issues(company: Company, gh: GitHub, problems: list) -> int:
    dev = company.agent("developer")
    if dev is None or not problems:
        return 0
    dev.require("read_repo")
    existing = gh.open_issue_titles()
    made = 0
    for finding in problems:
        title = f"[{finding.owner}] {finding.text}"[:120]
        if title in existing:
            continue
        try:
            plan = dev.think(
                f"فريق الموقع لقى المشكلة دي في موقع STRATIX (Express + React على Railway):\n{finding.text}\n"
                "اكتب في \"say\": السبب المحتمل، وخطوات الحل، وإزاي نتأكد إنها اتحلت."
                " لو مش متأكد من السبب قول كده."
            )
            body = f"**المشكلة:** {finding.text}\n\n**تحليل المطوّر:**\n{plan['say']}"
            if plan["unknowns"]:
                body += "\n\n**مش متأكد من:** " + "، ".join(plan["unknowns"])
        except AllModelsUnavailable:
            body = f"**المشكلة:** {finding.text}\n\n(مفيش موديل متاح للتحليل النهارده.)"
        issue = gh.create_issue(title, body)
        dev.log(f"فتحت Issue #{issue['number']}: {title}")
        made += 1
    return made


def review_pulls(company: Company, gh: GitHub, max_diff_chars: int = 30_000) -> int:
    reviewer = company.agent("reviewer")
    if reviewer is None:
        return 0
    reviewer.require("comment_pull_request")
    reviewed = 0
    for pr in gh.open_pulls():
        if any(REVIEW_MARK in (c.get("body") or "") for c in gh.comments(pr["number"])):
            continue  # اتراجع قبل كده
        diff = gh.diff(pr["number"])
        truncated = len(diff) > max_diff_chars
        try:
            review = reviewer.think(
                f"راجعي الـ Pull Request ده: \"{pr['title']}\"\n```diff\n{diff[:max_diff_chars]}\n```\n"
                + ("(الـ diff أطول من كده واتقص.)\n" if truncated else "")
                + "في \"say\": مشاكل حقيقية بس (bugs، أمان، حاجة هتكسر الموقع)، كل واحدة بالملف والسطر."
                " لو مفيش مشاكل قولي كده. ماتألفيش مشاكل."
            )
        except AllModelsUnavailable:
            continue
        verdict = {"high": "", "medium": " (ثقة متوسطة)", "low": " (ثقة ضعيفة — راجعها بنفسك)"}[review["confidence"]]
        gh.comment(pr["number"], f"{REVIEW_MARK}\n**مراجعة رنا{verdict}:**\n\n{review['say']}{FOOTER}")
        reviewer.log(f"راجعت PR #{pr['number']}: {pr['title']}")
        reviewed += 1
    return reviewed
