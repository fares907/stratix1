import { describe, expect, it } from "vitest";
import { getChatbotAnswer } from "./chatbot";

describe("STRATIX fixed-answer chatbot", () => {
  it.each([
    ["الاسعار كام؟", "price", "700"],
    ["مدة التنفيذ قد ايه", "duration", "أسبوع"],
    ["بتعملوا مواقع شركات؟", "services", "شركة متخصصة"],
    ["رقم التواصل", "contact", "01125839109"],
    ["مين المؤسسين؟", "founders", "فارس سامي"],
    ["بتعملوا متاجر الكترونيه؟", "ecommerce", "متجراً إلكترونياً"],
    ["فيه تعديلات مجانيه؟", "revisions", "2-3"],
    ["بتقدموا صيانه بعد الاطلاق؟", "maintenance", "صيانة"],
    ["ازاي الدفع بيتم؟", "payment", "حجم كل مشروع"],
    ["الموقع هيشتغل على الموبايل؟", "mobile", "الموبايل"],
    ["السلام عليكم", "greeting", "أهلاً"],
    ["شكراً جزيلاً", "thanks", "العفو"],
    ["ممكن اشوف اعمال سابقه؟", "portfolio", "أعمالنا"],
    ["بتساعدوا في الدومين والاستضافه؟", "domain_hosting", "الدومين"],
    ["بتشتغلوا مع عملاء برا مصر؟", "international", "أي دولة"],
    ["بتعملوا تطبيقات موبايل؟", "app", "تطبيقات منفصلة"],
    ["انت بوت ولا انسان؟", "chatbot_meta", "مساعد STRATIX الآلي"],
    ["ليه اختاركم عن غيركم؟", "why_choose_us", "كود مخصص"],
    ["بتشتغلوا مع مشروع صغير؟", "small_business", "أي حجم مشروع"],
    ["ممكن تسرّعوا التسليم انا مستعجل؟", "urgent_project", "وقت الحجز"],
    ["فيه استشاره مجانيه؟", "free_consultation", "نقاش مجاني"],
    ["اصغر مشروع ممكن تعملوه ايه؟", "min_project", "700 جنيه"],
    ["عندكم تقسيط للسعر؟", "installments", "مراحل"],
    ["هل املك الموقع بعد التسليم؟", "source_code_ownership", "ملكك بالكامل"],
    ["اقدر انقل الموقع لمبرمج تاني بعدين؟", "switch_developer", "أي مبرمج"],
    ["هتعلموني استخدم الموقع ازاي؟", "training", "بعد التسليم"],
    ["لو الموقع وقع بتتصرفوا ازاي؟", "downtime_reliability", "شركة الاستضافة"],
    ["تقدروا تنقلوا موقعي من ويكس؟", "migrate_platform", "كود مخصص"],
    ["تقدروا تعملوا ايميل احترافي للشركه؟", "email_setup", "بريد إلكتروني احترافي"],
    ["بتعملوا لوجو؟", "branding_logo", "شعار بسيط"],
    ["تقدروا تضيفوا صفحة الخصوصيه؟", "privacy_terms_pages", "سياسة الخصوصية"],
    ["الموقع بيراعي ذوي الهمم؟", "accessibility", "إمكانية الوصول"],
    ["اقدر اشوف عدد زوار موقعي؟", "analytics_reports", "أداة تحليلات"],
    ["الشات بوت ده ذكاء اصطناعي؟", "ai_features", "مش موديل ذكاء اصطناعي"],
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
    ["hello there", "greeting", "Welcome"],
    ["thank you so much", "thanks", "welcome"],
    ["can I see your portfolio?", "portfolio", "work-examples"],
    ["do you help with domain and hosting?", "domain_hosting", "domain and hosting"],
    ["do you work with clients outside egypt?", "international", "any country"],
    ["do you build mobile apps?", "app", "native"],
    ["are you a bot or human?", "chatbot_meta", "automated assistant"],
    ["why choose stratix over others?", "why_choose_us", "custom code"],
    ["do you work with small businesses?", "small_business", "any project size"],
    ["can you deliver faster, it's urgent?", "urgent_project", "shorten the timeline"],
    ["is there a free consultation?", "free_consultation", "free discussion"],
    ["what's the smallest project you take?", "min_project", "700 EGP"],
    ["can I pay in installments?", "installments", "stages"],
    ["do I fully own the website?", "source_code_ownership", "fully yours"],
    ["can I move to another developer later?", "switch_developer", "any other developer"],
    ["will you show me how to use the site?", "training", "walk you through"],
    ["what if the site goes down?", "downtime_reliability", "hosting provider"],
    ["can you migrate my site from wix?", "migrate_platform", "custom code"],
    ["can you set up a professional business email?", "email_setup", "professional email"],
    ["can you create a logo for my brand?", "branding_logo", "simple logo"],
    ["can you add a privacy policy page?", "privacy_terms_pages", "privacy policy"],
    ["is the site accessible?", "accessibility", "accessibility basics"],
    ["can I see visitor stats?", "analytics_reports", "analytics tool"],
    ["is this chatbot ai?", "ai_features", "not a paid ai model"],
  ])("matches %s (en) to the expected answer", (question, id, phrase) => {
    const answer = getChatbotAnswer(question, "en");
    expect(answer.id).toBe(id);
    expect(answer.text.toLowerCase()).toContain(phrase.toLowerCase());
  });

  it("returns a guided fallback for unsupported questions", () => {
    expect(getChatbotAnswer("ما حالة الطقس اليوم؟", "ar").id).toBe("fallback");
    expect(getChatbotAnswer("what's the weather today?", "en").id).toBe("fallback");
  });

  // The handoff intent must both match and carry the action flag, since the
  // widget keys the "leave your number" flow off that flag, not the text.
  it.each([
    ["عايز اكلم حد من الفريق", "ar"],
    ["محتاج خدمة العملاء", "ar"],
    ["عندي مشكلة في موقعي", "ar"],
    ["i want to talk to a human", "en"],
    ["customer service please", "en"],
    ["problem with my site", "en"],
  ] as const)("routes '%s' to the handoff flow", (question, lang) => {
    const answer = getChatbotAnswer(question, lang);
    expect(answer.id).toBe("human_contact");
    expect(answer.action).toBe("handoff");
  });

  it("does not trigger handoff for an ordinary pricing question", () => {
    expect(getChatbotAnswer("الاسعار كام؟", "ar").action).toBeUndefined();
  });
});
