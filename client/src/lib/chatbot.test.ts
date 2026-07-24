import { describe, expect, it } from "vitest";
import { getChatbotAnswer } from "./chatbot";

describe("STRATIX fixed-answer chatbot", () => {
  it.each([
    ["الاسعار كام؟", "price", "700"],
    ["مدة التنفيذ قد ايه", "duration", "أسبوع"],
    ["بتعملوا مواقع شركات؟", "services", "مواقع الشركات"],
    ["رقم التواصل", "contact", "01125839109"],
    ["مين المؤسسين؟", "founders", "فارس سامي"],
  ])("matches %s to the expected answer", (question, id, phrase) => {
    const answer = getChatbotAnswer(question);
    expect(answer.id).toBe(id);
    expect(answer.text).toContain(phrase);
  });

  it("returns a guided fallback for unsupported questions", () => {
    expect(getChatbotAnswer("ما حالة الطقس اليوم؟").id).toBe("fallback");
  });
});
