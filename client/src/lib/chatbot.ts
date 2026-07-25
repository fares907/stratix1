import type { Language } from "./translations";

export type ChatbotAnswer = {
  id: string;
  text: string;
};

type LocalizedText = Record<Language, string>;

type ChatbotIntent = {
  id: string;
  label: LocalizedText;
  keywords: Record<Language, string[]>;
  text: LocalizedText;
};

const intents: ChatbotIntent[] = [
  {
    id: "services",
    label: { ar: "الشركة بتعمل ايه؟", en: "What does the company do?" },
    keywords: {
      ar: ["خدم", "موقع", "مواقع", "ويب", "سايت", "شرك", "اعمال", "هبوط", "تصميم", "برمج", "تعمل", "تعملوا", "شغل", "شغلكم", "مين انتوا", "تخصص"],
      en: ["service", "website", "web", "design", "develop", "company", "offer", "build", "personal", "what do you do"],
    },
    text: {
      ar: "STRATIX استوديو بيصمم ويبرمج مواقع الشركات والمواقع الشخصية. نحدد الشكل والوظائف المناسبة بعد فهم هدف مشروعك.",
      en: "STRATIX is a studio that designs and builds company and personal websites. We shape the design and features once we understand your project's goal.",
    },
  },
  {
    id: "price",
    label: { ar: "الأسعار تبدأ من كام؟", en: "What are your prices?" },
    keywords: {
      ar: ["سعر", "اسعار", "تكلف", "كام", "بكام", "ميزاني", "700", "فصال", "مفاصل"],
      en: ["price", "cost", "pricing", "how much", "budget", "negotiat", "700"],
    },
    text: {
      ar: "الأسعار تبدأ من 700 جنيه وما فوق بدون فصال، وتزيد حسب عدد الصفحات، الوظائف المطلوبة، ومستوى التصميم والحركة.",
      en: "Prices start at 700 EGP and up, no negotiation — increasing based on the number of pages, required features, and the level of design and animation.",
    },
  },
  {
    id: "duration",
    label: { ar: "مدة التنفيذ قد إيه؟", en: "How long does it take?" },
    keywords: {
      ar: ["مده", "وقت", "اسبوع", "تسليم", "يخلص", "تنفيذ"],
      en: ["duration", "time", "week", "deliver", "how long", "timeline"],
    },
    text: {
      ar: "المدة المعتادة نحو أسبوع من اعتماد التفاصيل والمحتوى، وقد تتغير إذا كان المشروع أكبر أو يحتاج وظائف خاصة.",
      en: "The usual timeline is about one week from approving the details and content, and may change for larger projects or ones needing special features.",
    },
  },
  {
    id: "booking",
    label: { ar: "إزاي أحجز؟", en: "How do I book?" },
    keywords: {
      ar: ["حجز", "احجز", "ابدأ", "طلب", "اتفق", "مشروع"],
      en: ["book", "booking", "start", "order", "request", "project"],
    },
    text: {
      ar: "انزل إلى قسم الحجز، اكتب بياناتك وفكرة الموقع، ثم اضغط «إرسال طلب الحجز». سيظهر لك رقم طلب محفوظ فوراً.",
      en: 'Scroll down to the booking section, enter your details and your website idea, then click "Send Booking Request". You\'ll get a saved order number right away.',
    },
  },
  {
    id: "contact",
    label: { ar: "أرقام التواصل؟", en: "Contact numbers?" },
    keywords: {
      ar: ["تواصل", "رقم", "هاتف", "تليفون", "واتس", "كلم", "اتصال"],
      en: ["contact", "phone", "number", "whatsapp", "call", "reach"],
    },
    text: {
      ar: "يمكنك التواصل على 01125839109 أو 01036678093 (متاحون على واتساب كمان)، أو عبر البريد stratix255@gmail.com.",
      en: "You can reach us at 01125839109 or 01036678093 (also available on WhatsApp), or by email at stratix255@gmail.com.",
    },
  },
  {
    id: "founders",
    label: { ar: "مين مؤسسو STRATIX؟", en: "Who are STRATIX's founders?" },
    keywords: {
      ar: ["مؤسس", "موسس", "فارس", "يوسف", "فريق", "صاحب"],
      en: ["founder", "fares", "youssef", "team", "owner"],
    },
    text: {
      ar: "مؤسسا STRATIX هما فارس سامي عبد العزيز السيد، ويوسف تامر السيد أحمد.",
      en: "STRATIX's founders are Fares Samy Abdelaziz Elsayed and Youssef Tamer Elsayed Ahmed.",
    },
  },
  {
    id: "security",
    label: { ar: "هل الموقع بيكون آمن؟", en: "Is the website secure?" },
    keywords: {
      ar: ["امن", "امان", "حماي", "سريع", "اداء", "طلبات", "سيرفر"],
      en: ["secure", "security", "protect", "fast", "performance", "load", "server"],
    },
    text: {
      ar: "نطبّق تحققاً صارماً من البيانات، حماية من التكرار والإساءة، واتصالاً آمناً. مستوى التحمل الفعلي يعتمد على الاستضافة والاختبار الواقعي للحمل.",
      en: "We apply strict data validation, protection against duplication and abuse, and a secure connection. Actual load capacity depends on hosting and real-world load testing.",
    },
  },
];

const emptyText: LocalizedText = {
  ar: "اكتب سؤالك أو اختر واحداً من الأسئلة السريعة بالأسفل.",
  en: "Type your question or choose one of the quick questions below.",
};

const fallbackText: LocalizedText = {
  ar: "أقدر أساعدك في الخدمات، السعر، مدة التنفيذ، الحجز، الأمان، أو أرقام التواصل. اختر سؤالاً سريعاً لأعطيك الإجابة الدقيقة.",
  en: "I can help with services, pricing, timeline, booking, security, or contact info. Choose a quick question for a precise answer.",
};

export function getChatbotQuickQuestions(language: Language) {
  return intents.slice(0, 5).map(({ id, label }) => ({ id, label: label[language] }));
}

const ARABIC_DIACRITICS_PATTERN = new RegExp("[\\u064B-\\u065F\\u0670]", "g");
const NON_WORD_PATTERN = new RegExp("[^\\u0600-\\u06FFA-Za-z0-9\\s]", "g");

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(ARABIC_DIACRITICS_PATTERN, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(NON_WORD_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getChatbotAnswer(question: string, language: Language): ChatbotAnswer {
  const normalized = normalizeText(question);
  if (!normalized) {
    return { id: "empty", text: emptyText[language] };
  }

  const scored = intents
    .map(intent => ({
      intent,
      score: intent.keywords[language].reduce(
        (total, keyword) => total + (normalized.includes(normalizeText(keyword)) ? 1 : 0),
        0,
      ),
    }))
    .sort((left, right) => right.score - left.score);

  if (scored[0]?.score) return { id: scored[0].intent.id, text: scored[0].intent.text[language] };

  return { id: "fallback", text: fallbackText[language] };
}
