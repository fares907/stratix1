import { describe, expect, it } from "vitest";
import { getChatbotAnswer } from "./chatbot";

describe("STRATIX fixed-answer chatbot", () => {
  it.each([
    ["الاسعار كام؟", "price", "700"],
    ["مدة التنفيذ قد ايه", "duration", "أسبوع"],
    ["بتعملوا مواقع شركات؟", "services", "مواقع الشركات"],
    ["رقم التواصل", "contact", "01125839109"],
    ["مين المؤسسين؟", "founders", "فارس سامي"],
    ["بتعملوا متاجر الكترونيه؟", "ecommerce", "متجراً إلكترونياً"],
    ["فيه تعديلات مجانيه؟", "revisions", "2-3"],
    ["بتقدموا صيانه بعد الاطلاق؟", "maintenance", "صيانة"],
    ["ازاي الدفع بيتم؟", "payment", "حجم كل مشروع"],
    ["الموقع هيشتغل على الموبايل؟", "mobile", "الموبايل"],
  ])("matches %s (ar) to the expected answer", (question, id, phrase) => {
    const answer = getChatbotAnswer(question, "ar");
    expect(answer.id).toBe(id);
    expect(answer.text).toContain(phrase);
  });

  it.each([
    ["how much does it cost?", "price", "700"],
    ["how long does it take", "duration", "one week"],
    ["do you build company websites?", "services", "company"],
    ["contact number", "contact", "01125839109"],
    ["who are the founders?", "founders", "Fares Samy"],
    ["do you build online stores?", "ecommerce", "online store"],
    ["are there free revisions?", "revisions", "2-3"],
    ["do you offer support after launch?", "maintenance", "maintenance"],
    ["how does payment work?", "payment", "project's size"],
    ["will the site work on mobile?", "mobile", "mobile"],
  ])("matches %s (en) to the expected answer", (question, id, phrase) => {
    const answer = getChatbotAnswer(question, "en");
    expect(answer.id).toBe(id);
    expect(answer.text.toLowerCase()).toContain(phrase.toLowerCase());
  });

  it("returns a guided fallback for unsupported questions", () => {
    expect(getChatbotAnswer("ما حالة الطقس اليوم؟", "ar").id).toBe("fallback");
    expect(getChatbotAnswer("what's the weather today?", "en").id).toBe("fallback");
  });
});
