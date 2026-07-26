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
      ar: ["خدم", "شرك", "اعمال", "تصميم", "برمج", "تعمل", "تعملوا", "شغل", "شغلكم", "مين انتوا", "تخصص"],
      en: ["service", "design", "develop", "company", "offer", "personal", "what do you do"],
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
    id: "technology",
    label: { ar: "بتستخدموا إيه في بناء المواقع؟", en: "What technology do you use?" },
    keywords: {
      ar: ["تقنيه", "تكنولوجيا", "برمجه", "برمجة", "ووردبريس", "كود", "لغة برمجة"],
      en: ["technology", "tech stack", "wordpress", "code", "platform", "built with", "coded"],
    },
    text: {
      ar: "بنبني المواقع بكود مخصص وحديث، مش قوالب جاهزة، عشان الموقع يبقى سريع وآمن ومصمم خصيصاً لهدفك بدل شكل مكرر زي أي حد تاني.",
      en: "We build with modern, custom code — not ready-made templates — so the site is fast, secure, and designed specifically for your goal instead of a repeated look like everyone else's.",
    },
  },
  {
    id: "ecommerce",
    label: { ar: "بتعملوا متاجر إلكترونية؟", en: "Do you build online stores?" },
    keywords: {
      ar: ["متجر", "متاجر", "تجاره", "تجارة", "بيع", "منتجات", "اونلاين", "كوميرس", "الكترونيه", "الكترونية"],
      en: ["store", "stores", "shop", "ecommerce", "e-commerce", "sell", "products", "cart"],
    },
    text: {
      ar: "أيوه، نقدر نبني متجراً إلكترونياً كاملاً حسب احتياجك (عرض منتجات، سلة شراء، ربط دفع)، وده بيتحدد كمشروع خاص بعد ما نتناقش في التفاصيل.",
      en: "Yes, we can build a full online store based on your needs (product listings, cart, payment integration) — this is scoped as its own project once we discuss the details.",
    },
  },
  {
    id: "redesign",
    label: { ar: "بتعدّلوا على موقع موجود؟", en: "Can you redesign an existing website?" },
    keywords: {
      ar: ["موقع موجود", "اعاده تصميم", "إعادة تصميم", "تطوير موقع", "عندي موقع"],
      en: ["redesign", "existing website", "already have a site", "revamp"],
    },
    text: {
      ar: "أيوه، نقدر نطوّر أو نعيد تصميم موقع عندك بالفعل، أو نبنيلك موقع من الصفر — اللي يناسب حالتك.",
      en: "Yes, we can improve or redesign a website you already have, or build one from scratch — whatever fits your situation.",
    },
  },
  {
    id: "content",
    label: { ar: "مين اللي بيكتب محتوى الموقع؟", en: "Who writes the website content?" },
    keywords: {
      ar: ["محتوى", "نصوص", "اكتب", "صور الموقع"],
      en: ["content", "copywriting", "who writes", "text for the site"],
    },
    text: {
      ar: "تقدر تديلنا المحتوى (النصوص والصور) جاهزاً، أو نساعدك نظبطه سوا وقت العمل على مشروعك — الاتنين ممكنين.",
      en: "You can give us ready content (text and images), or we can help put it together with you while working on your project — both options work.",
    },
  },
  {
    id: "seo",
    label: { ar: "الموقع هيظهر في جوجل؟", en: "Will the site show up on Google?" },
    keywords: {
      ar: ["جوجل", "سيو", "بحث", "ظهور", "نتائج البحث"],
      en: ["google", "seo", "search", "ranking", "show up"],
    },
    text: {
      ar: "بنبني الموقع بأساسيات SEO صحيحة (سرعة، عنوان ووصف واضح، بيانات منظمة) تساعد جوجل يفهمه ويفهرسه أسرع، لكن الظهور في نتائج البحث للكلمات العامة بياخد وقت ومجهود مستمر مش بيحصل فوراً.",
      en: "We build the site with solid SEO fundamentals (speed, clear title and description, structured data) that help Google understand and index it faster, but ranking for general search terms takes time and ongoing effort — it doesn't happen instantly.",
    },
  },
  {
    id: "mobile",
    label: { ar: "الموقع هيشتغل على الموبايل؟", en: "Will the site work on mobile?" },
    keywords: {
      ar: ["موبايل", "تليفون", "شاشات", "متجاوب"],
      en: ["mobile", "phone", "responsive", "tablet"],
    },
    text: {
      ar: "أكيد، كل موقع بنعمله بيتصمم عشان يشتغل ويبان كويس على الموبايل والتابلت والكمبيوتر من غير أي فرق في الجودة.",
      en: "Absolutely — every website we build is designed to work and look great on mobile, tablet, and desktop with no drop in quality.",
    },
  },
  {
    id: "pages",
    label: { ar: "كام صفحة بتكون في الموقع؟", en: "How many pages does the site include?" },
    keywords: {
      ar: ["كام صفحه", "عدد الصفحات", "صفحات"],
      en: ["how many pages", "page count", "number of pages"],
    },
    text: {
      ar: "عدد الصفحات بيختلف حسب احتياج مشروعك — ممكن يكون موقع صفحة واحدة، أو موقع متعدد الصفحات (خدمات، من نحن، تواصل، إلخ)، وده بيتحدد بعد ما نفهم فكرتك.",
      en: "The number of pages depends on what your project needs — it could be a single-page site, or a multi-page one (services, about, contact, etc.), decided once we understand your idea.",
    },
  },
  {
    id: "payment",
    label: { ar: "إزاي الدفع بيتم؟", en: "How does payment work?" },
    keywords: {
      ar: ["دفع", "ادفع", "عربون", "مقدم", "فلوس", "تحويل"],
      en: ["payment", "pay", "deposit", "upfront", "money", "transfer"],
    },
    text: {
      ar: "الدفع بيتحدد حسب حجم كل مشروع، وبنتفق عليه معاك بالتفصيل بعد ما نراجع طلبك — مفيش نظام دفع ثابت واحد لكل العملاء.",
      en: "Payment is arranged based on each project's size, and we agree on the details with you after reviewing your request — there's no single fixed payment plan for everyone.",
    },
  },
  {
    id: "revisions",
    label: { ar: "هل فيه تعديلات مجانية؟", en: "Are there free revisions?" },
    keywords: {
      ar: ["تعديل", "تعديلات", "تغيير", "عدل"],
      en: ["revision", "revisions", "change", "edit", "edits"],
    },
    text: {
      ar: "أيوه، بيكون معاك عدد محدد من التعديلات المجانية (حوالي 2-3) قبل ما نسلّم الموقع النهائي، عشان نتأكد إنك راضي عن الشكل والمحتوى.",
      en: "Yes, you get a set number of free revisions (around 2-3) before we hand over the final website, to make sure you're happy with the design and content.",
    },
  },
  {
    id: "maintenance",
    label: { ar: "بتقدموا صيانة بعد الإطلاق؟", en: "Do you offer support after launch?" },
    keywords: {
      ar: ["صيانه", "صيانة", "دعم", "بعد الاطلاق", "مشكله بعدين"],
      en: ["maintenance", "support", "after launch", "ongoing"],
    },
    text: {
      ar: "أيوه، متاح دعم وصيانة بعد إطلاق الموقع مقابل رسوم إضافية حسب نوع الدعم المطلوب — التفاصيل بتتحدد وقت ما تحتاجها.",
      en: "Yes, post-launch support and maintenance is available for an additional fee depending on what you need — details are worked out when you need it.",
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
