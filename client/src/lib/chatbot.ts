export type ChatbotAnswer = {
  id: string;
  text: string;
};

type ChatbotIntent = ChatbotAnswer & {
  label: string;
  keywords: string[];
};

const intents: ChatbotIntent[] = [
  {
    id: "services",
    label: "الشركة بتعمل ايه؟",
    keywords: ["خدم", "موقع", "مواقع", "ويب", "سايت", "شرك", "اعمال", "هبوط", "تصميم", "برمج", "تعمل", "تعملوا", "شغل", "شغلكم", "مين انتوا", "تخصص"],
    text: "STRATIX استوديو بيصمم ويبرمج مواقع الشركات، ملفات الأعمال، وصفحات الهبوط. نحدد الشكل والوظائف المناسبة بعد فهم هدف مشروعك.",
  },
  {
    id: "price",
    label: "الأسعار تبدأ من كام؟",
    keywords: ["سعر", "اسعار", "تكلف", "كام", "بكام", "ميزاني", "700", "فصال", "مفاصل"],
    text: "الأسعار تبدأ من 700 جنيه وما فوق بدون فصال، وتزيد حسب عدد الصفحات، الوظائف المطلوبة، ومستوى التصميم والحركة.",
  },
  {
    id: "duration",
    label: "مدة التنفيذ قد إيه؟",
    keywords: ["مده", "وقت", "اسبوع", "تسليم", "يخلص", "تنفيذ"],
    text: "المدة المعتادة نحو أسبوع من اعتماد التفاصيل والمحتوى، وقد تتغير إذا كان المشروع أكبر أو يحتاج وظائف خاصة.",
  },
  {
    id: "booking",
    label: "إزاي أحجز؟",
    keywords: ["حجز", "احجز", "ابدأ", "طلب", "اتفق", "مشروع"],
    text: "انزل إلى قسم الحجز، اكتب بياناتك وفكرة الموقع، ثم اضغط «إرسال طلب الحجز». سيظهر لك رقم طلب محفوظ فوراً.",
  },
  {
    id: "contact",
    label: "أرقام التواصل؟",
    keywords: ["تواصل", "رقم", "هاتف", "تليفون", "واتس", "كلم", "اتصال"],
    text: "يمكنك التواصل على 01125839109 أو 01036678093 (متاحون على واتساب كمان)، أو عبر البريد stratix255@gmail.com.",
  },
  {
    id: "founders",
    label: "مين مؤسسو STRATIX؟",
    keywords: ["مؤسس", "موسس", "فارس", "يوسف", "فريق", "صاحب"],
    text: "مؤسسا STRATIX هما فارس سامي عبد العزيز السيد، ويوسف تامر السيد أحمد.",
  },
  {
    id: "security",
    label: "هل الموقع بيكون آمن؟",
    keywords: ["امن", "امان", "حماي", "سريع", "اداء", "طلبات", "سيرفر"],
    text: "نطبّق تحققاً صارماً من البيانات، حماية من التكرار والإساءة، واتصالاً آمناً. مستوى التحمل الفعلي يعتمد على الاستضافة والاختبار الواقعي للحمل.",
  },
];

export const chatbotQuickQuestions = intents.slice(0, 5).map(({ id, label }) => ({ id, label }));

function normalizeArabic(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0600-\u06FFA-Za-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getChatbotAnswer(question: string): ChatbotAnswer {
  const normalized = normalizeArabic(question);
  if (!normalized) {
    return { id: "empty", text: "اكتب سؤالك أو اختر واحداً من الأسئلة السريعة بالأسفل." };
  }

  const scored = intents
    .map(intent => ({
      intent,
      score: intent.keywords.reduce(
        (total, keyword) => total + (normalized.includes(normalizeArabic(keyword)) ? 1 : 0),
        0,
      ),
    }))
    .sort((left, right) => right.score - left.score);

  if (scored[0]?.score) return scored[0].intent;

  return {
    id: "fallback",
    text: "أقدر أساعدك في الخدمات، السعر، مدة التنفيذ، الحجز، الأمان، أو أرقام التواصل. اختر سؤالاً سريعاً لأعطيك الإجابة الدقيقة.",
  };
}
