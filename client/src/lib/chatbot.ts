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
    id: "greeting",
    label: { ar: "أهلاً", en: "Say hi" },
    keywords: {
      ar: ["السلام عليكم", "سلام", "اهلا", "أهلا", "مرحبا", "هاي", "صباح الخير", "مساء الخير"],
      en: ["hello", "hi", "hey", "good morning", "good evening", "greetings"],
    },
    text: {
      ar: "أهلاً بيك في STRATIX! أنا هنا أجاوبك على أي سؤال عن خدماتنا وأسعارنا وطريقة الحجز. اسأل براحتك.",
      en: "Welcome to STRATIX! I'm here to answer anything about our services, pricing, or how to book. Ask away.",
    },
  },
  {
    id: "thanks",
    label: { ar: "شكراً", en: "Thanks" },
    keywords: {
      ar: ["شكرا", "شكراً", "متشكر", "تمام كده", "تسلم", "ربنا يكرمك"],
      en: ["thanks", "thank you", "appreciate it", "cool", "great thanks"],
    },
    text: {
      ar: "العفو! لو عندك أي سؤال تاني أنا موجود، أو تقدر تكلمنا مباشرة على واتساب.",
      en: "You're welcome! I'm here for any other question, or you can reach us directly on WhatsApp.",
    },
  },
  {
    id: "services",
    label: { ar: "الشركة بتعمل ايه؟", en: "What does the company do?" },
    keywords: {
      ar: ["خدم", "شرك", "اعمال", "تصميم", "برمج", "تعمل", "تعملوا", "شغل", "شغلكم", "مين انتوا", "تخصص", "بتقدموا ايه"],
      en: ["service", "design", "develop", "company", "offer", "personal", "what do you do", "who are you"],
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
      ar: ["مده", "وقت", "اسبوع", "تسليم", "يخلص", "تنفيذ", "امتى هيخلص"],
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
      ar: ["حجز", "احجز", "ابدأ", "طلب", "اتفق", "مشروع", "عايز اطلب"],
      en: ["book", "booking", "start", "order", "request", "project"],
    },
    text: {
      ar: "انزل إلى قسم الحجز، اكتب بياناتك وفكرة الموقع، ثم اضغط «إرسال طلب الحجز». سيظهر لك رقم طلب محفوظ فوراً.",
      en: 'Scroll down to the booking section, enter your details and your website idea, then click "Send Booking Request". You\'ll get a saved order number right away.',
    },
  },
  {
    id: "materials_needed",
    label: { ar: "محتاجين مني ايه عشان نبدأ؟", en: "What do you need from me to start?" },
    keywords: {
      ar: ["محتاجين مني", "ابعتلكم", "عشان نبدأ", "استعد", "جهز"],
      en: ["what do you need from me", "get started", "prepare", "before we start"],
    },
    text: {
      ar: "بس اسمك، فكرة عن الموقع، ونوعه (شركة ولا شخصي). لو عندك محتوى أو تصميم في بالك ابعتهولنا، ولو لأ إحنا نساعدك نظبطه أثناء العمل.",
      en: "Just your name and an idea of what the site is for (company or personal). If you have content or a design in mind, send it over — if not, we'll help shape it while we work.",
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
    id: "app",
    label: { ar: "بتعملوا تطبيقات موبايل؟", en: "Do you build mobile apps?" },
    keywords: {
      ar: ["تطبيق", "تطبيقات", "اندرويد", "ايفون", "app موبايل"],
      en: ["mobile app", "app", "android", "ios", "native app"],
    },
    text: {
      ar: "دلوقتي تخصصنا هو مواقع الويب اللي بتشتغل زي التطبيق تماماً على الموبايل، ومش بنعمل تطبيقات منفصلة على أندرويد أو آيفون حالياً.",
      en: "Right now we focus on websites that work just like an app on mobile — we don't build separate native Android or iOS apps at this time.",
    },
  },
  {
    id: "bilingual",
    label: { ar: "الموقع بيدعم لغتين؟", en: "Can the site support two languages?" },
    keywords: {
      ar: ["لغتين", "عربي وانجليزي", "لغات", "ترجمة الموقع"],
      en: ["bilingual", "multilingual", "two languages", "arabic and english", "translation"],
    },
    text: {
      ar: "أيوه، نقدر نبني الموقع بلغة واحدة أو بلغتين (عربي وإنجليزي) مع إمكانية التبديل بينهم، حسب احتياج مشروعك.",
      en: "Yes, we can build the site in one language or bilingual (Arabic and English) with a toggle between them, depending on what your project needs.",
    },
  },
  {
    id: "domain_hosting",
    label: { ar: "بتساعدوا في الدومين والاستضافة؟", en: "Do you help with domain and hosting?" },
    keywords: {
      ar: ["دومين", "استضافه", "استضافة", "هوستنج", "اسم الموقع"],
      en: ["domain", "hosting", "server", "domain name"],
    },
    text: {
      ar: "أيوه، نقدر نساعدك تختار وتربط الدومين والاستضافة المناسبين لمشروعك، والتفاصيل بتتحدد حسب احتياجك.",
      en: "Yes, we can help you choose and connect the right domain and hosting for your project — the details are worked out based on what you need.",
    },
  },
  {
    id: "cms_edit",
    label: { ar: "أقدر أعدل على المحتوى بنفسي بعدين؟", en: "Can I edit the content myself later?" },
    keywords: {
      ar: ["اعدل بنفسي", "لوحة تحكم", "غير المحتوى", "cms"],
      en: ["edit myself", "admin panel", "cms", "update content myself"],
    },
    text: {
      ar: "حسب طبيعة مشروعك، ممكن نضيفلك طريقة بسيطة تعدل بيها بنفسك، أو نتكفل إحنا بالتعديلات كخدمة صيانة — بنتفق على الأنسب ليك.",
      en: "Depending on your project, we can add a simple way for you to edit things yourself, or handle updates for you as a maintenance service — we agree on what fits best.",
    },
  },
  {
    id: "international",
    label: { ar: "بتشتغلوا مع عملاء برا مصر؟", en: "Do you work with clients outside Egypt?" },
    keywords: {
      ar: ["برا مصر", "دوله تانيه", "خارج مصر", "عميل اجنبي"],
      en: ["outside egypt", "international client", "abroad", "another country"],
    },
    text: {
      ar: "أيوه، بنشتغل مع عملاء من أي دولة — نموذج الحجز بيقبل أرقام هواتف دولية، والتواصل والتنفيذ بيتم عن بُعد بسهولة.",
      en: "Yes, we work with clients from any country — the booking form accepts international phone numbers, and communication and delivery happen remotely with no issue.",
    },
  },
  {
    id: "marketing",
    label: { ar: "بتقدموا تسويق أو سوشيال ميديا؟", en: "Do you offer marketing or social media?" },
    keywords: {
      ar: ["تسويق", "سوشيال ميديا", "اعلانات", "ماركتنج"],
      en: ["marketing", "social media", "ads", "advertising"],
    },
    text: {
      ar: "تخصصنا الأساسي هو تصميم وبرمجة المواقع. لو محتاج تسويق أو إدارة سوشيال ميديا، تواصل معنا ونتناقش في الإمكانية دي بشكل منفصل.",
      en: "Our core focus is website design and development. If you need marketing or social media management, reach out and we can discuss that separately.",
    },
  },
  {
    id: "portfolio",
    label: { ar: "ممكن أشوف أعمال سابقة؟", en: "Can I see previous work?" },
    keywords: {
      ar: ["اعمال سابقه", "شغل قبل كده", "امثله", "بورتفوليو"],
      en: ["portfolio", "previous work", "examples", "past projects"],
    },
    text: {
      ar: "لسه بنجهز صفحة أعمالنا على الموقع. تواصل معنا مباشرة وهنوريك أمثلة تناسب فكرة مشروعك.",
      en: "We're still preparing our work-examples page on the site. Reach out to us directly and we'll show you examples relevant to your project.",
    },
  },
  {
    id: "contract",
    label: { ar: "بيكون فيه اتفاق مكتوب؟", en: "Is there a written agreement?" },
    keywords: {
      ar: ["عقد", "اتفاقيه", "اتفاق مكتوب", "ورق"],
      en: ["contract", "agreement", "written agreement"],
    },
    text: {
      ar: "بنتفق معاك بوضوح على تفاصيل المشروع والسعر وطريقة الدفع قبل البدء، عشان الاتنين يكونوا على نفس الصفحة من الأول.",
      en: "We agree clearly on the project scope, price, and payment method with you before starting, so we're both on the same page from the beginning.",
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
    id: "satisfaction",
    label: { ar: "لو مش عاجبني الشكل؟", en: "What if I don't like the result?" },
    keywords: {
      ar: ["مش عاجبني", "مش راضي", "ضمان", "لو مش حبيت"],
      en: ["don't like it", "not satisfied", "guarantee", "what if i don't like"],
    },
    text: {
      ar: "عشان كده بنديك 2-3 تعديلات مجانية قبل التسليم النهائي، فبنتأكد إن الشكل والمحتوى عاجبك قبل ما نقفل المشروع.",
      en: "That's why you get 2-3 free revisions before final delivery — we make sure you're happy with the design and content before the project closes.",
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

const quickQuestionIds = ["services", "price", "duration", "booking", "contact"];

const emptyText: LocalizedText = {
  ar: "اكتب سؤالك أو اختر واحداً من الأسئلة السريعة بالأسفل.",
  en: "Type your question or choose one of the quick questions below.",
};

const fallbackText: LocalizedText = {
  ar: "أقدر أجاوب بس على الأسئلة المتعلقة بخدمات STRATIX (التصميم، الأسعار، الحجز، الدعم، وغيرها). جرب تسأل بطريقة تانية، أو اختار من الأسئلة السريعة بالأسفل، أو تواصل معنا مباشرة.",
  en: "I can only answer questions related to STRATIX's services (design, pricing, booking, support, and more). Try rephrasing, pick a quick question below, or reach out to us directly.",
};

export function getChatbotQuickQuestions(language: Language) {
  const byId = new Map(intents.map(intent => [intent.id, intent]));
  return quickQuestionIds
    .map(id => byId.get(id))
    .filter((intent): intent is ChatbotIntent => Boolean(intent))
    .map(({ id, label }) => ({ id, label: label[language] }));
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

// Precompute each intent's normalized keywords once instead of re-normalizing
// on every call. Arabic keywords are short stems by design (e.g. "شرك" is
// meant to match "شركة"/"شركات"/"الشركة") so matching stays substring-based —
// switching to whole-word matching would break every keyword that relies on
// matching inside a prefixed/suffixed inflection.
const intentKeywords = new Map<string, Record<Language, string[]>>(
  intents.map(intent => [
    intent.id,
    {
      ar: intent.keywords.ar.map(normalizeText),
      en: intent.keywords.en.map(normalizeText),
    },
  ]),
);

export function getChatbotAnswer(question: string, language: Language): ChatbotAnswer {
  const normalized = normalizeText(question);
  if (!normalized) {
    return { id: "empty", text: emptyText[language] };
  }

  const scored = intents
    .map(intent => {
      const keywords = intentKeywords.get(intent.id)![language];
      const score = keywords.reduce((total, keyword) => {
        if (!keyword || !normalized.includes(keyword)) return total;
        // Longer/more specific keywords count for more, so a precise phrase
        // match outranks an intent that only picked up a generic word in common.
        return total + keyword.length;
      }, 0);
      return { intent, score };
    })
    .sort((left, right) => right.score - left.score);

  if (scored[0]?.score) return { id: scored[0].intent.id, text: scored[0].intent.text[language] };

  return { id: "fallback", text: fallbackText[language] };
}
