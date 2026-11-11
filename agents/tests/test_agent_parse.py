from stratix_agents.agent import parse_reply
from stratix_agents.router import Completion


def _c(text):
    return Completion(text=text, model_key="groq:big", used_fallback=False, prompt_tokens=0, completion_tokens=0)


def test_parse_reply_extracts_fenced_json():
    reply = parse_reply(_c('```json\n{"say": "تمام", "decisions": [1], "confidence": "high"}\n```'))
    assert reply["say"] == "تمام"
    assert reply["decisions"] == [1]
    assert reply["confidence"] == "high"


def test_parse_reply_plain_text_kept():
    reply = parse_reply(_c("مش JSON خالص"))
    assert reply["say"] == "مش JSON خالص"
    assert reply["confidence"] == "low"
