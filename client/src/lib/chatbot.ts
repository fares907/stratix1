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
      ar: ["السلام عليكم", "سلام", "اهلا", "أهلا", "مرحبا", "هاي", "صباح الخير", "مساء الخير", "ازيك", "عامل ايه", "ايه الاخبار"],
      // "hi"/"yo" deliberately excluded — as bare 2-letter substrings they'd
      // false-positive inside unrelated words ("this", "beyond") under the
      // substring matcher below.
      en: ["hello", "hey", "good morning", "good evening", "greetings", "what's up"],
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
      ar: ["شكرا", "شكراً", "متشكر", "تمام كده", "تسلم", "ربنا يكرمك", "مشكور", "الله يخليك", "جزاك الله خير"],
      en: ["thanks", "thank you", "appreciate it", "cool", "great thanks", "much appreciated", "cheers"],
    },
    text: {
      ar: "العفو! لو عندك أي سؤال تاني أنا موجود، أو تقدر تكلمنا مباشرة على واتساب.",
      en: "You're welcome! I'm here for any other question, or you can reach us directly on WhatsApp.",
    },
  },
  {
    id: "chatbot_meta",
    label: { ar: "انت مين؟", en: "Are you a real person?" },
    keywords: {
      ar: ["انت مين", "انت بوت", "انسان ولا برنامج", "بتحاكي حد", "دردشه اليه"],
      en: ["are you a bot", "are you human", "are you ai", "who am i talking to", "is this automated"],
    },
    text: {
      ar: "أنا مساعد STRATIX الآلي — مبني على قاعدة أسئلة وأجوبة جاهزة (مش ذكاء اصطناعي)، وده بيخليني أجاوبك فوراً وبدقة على أي سؤال شائع عن خدماتنا.",
      en: "I'm STRATIX's automated assistant — built on a ready set of questions and answers (not AI), which lets me answer common questions about our services instantly and accurately.",
    },
  },
  {
    id: "why_choose_us",
    label: { ar: "ليه أختار STRATIX؟", en: "Why choose STRATIX?" },
    keywords: {
      ar: ["ليه اختاركم", "ليه استراتكس", "ايه اللي يميزكم", "احسن منكم مين"],
      en: ["why choose you", "why choose", "why stratix", "what makes you different", "better than others"],
    },
    text: {
      ar: "كود مخصص مش قوالب جاهزة، تسليم في حوالي أسبوع، سعر واضح بدون فصال، وتواصل مباشر مع فريق صغير بيتابع مشروعك بنفسه من الأول للآخر.",
      en: "Custom code instead of templates, delivery in about a week, clear no-negotiation pricing, and direct contact with a small team that follows your project from start to finish.",
    },
  },
  {
    id: "small_business",
    label: { ar: "بتشتغلوا مع مشاريع صغيرة؟", en: "Do you work with small businesses?" },
    keywords: {
      ar: ["مشروع صغير", "بيزنس صغير", "لسه بادئ", "مشروع ناشئ", "صفحة شخصية بس"],
      en: ["small business", "startup", "just starting out", "personal brand", "solo project"],
    },
    text: {
      ar: "أكيد، بنشتغل مع أي حجم مشروع — من صفحة شخصية بسيطة لحد موقع شركة كامل. السعر والوقت بيتحددوا حسب حجم اللي محتاجه فعلاً.",
      en: "Absolutely — we work with any project size, from a simple personal page to a full company website. Price and time are scoped to what you actually need.",
    },
  },
  {
    id: "urgent_project",
    label: { ar: "ممكن تسرّعوا التسليم؟", en: "Can you deliver faster?" },
    keywords: {
      ar: ["مستعجل", "اسرع من المعتاد", "ضروري بسرعه", "امتى اقصى حاجه"],
      en: ["urgent", "rush", "faster delivery", "faster", "asap", "expedite"],
    },
    text: {
      ar: "لو مشروعك مستعجل قولنا وقت الحجز، ونشوف نقدر نظبطه في وقت أقصر إزاي حسب حجمه — مش مضمون دايماً بس بنحاول.",
      en: "If your project is urgent, mention it when you book, and we'll see how much we can shorten the timeline based on its size — not always guaranteed, but we'll try.",
    },
  },
  {
    id: "free_consultation",
    label: { ar: "فيه استشارة مجانية؟", en: "Is there a free consultation?" },
    keywords: {
      ar: ["استشاره مجانيه", "معاينه مجانيه", "قبل ما ادفع", "اتكلم معاكم الأول"],
      en: ["free consultation", "free quote", "before i pay", "talk to you first"],
    },
    text: {
      ar: "أيوه، أول تواصل أو حجز بيكون نقاش مجاني عن فكرتك واحتياجك — من غير أي التزام — قبل ما نتفق على السعر والتفاصيل.",
      en: "Yes, the first conversation or booking is a free discussion about your idea and needs — no commitment — before we agree on price and details.",
    },
  },
  {
    id: "min_project",
    label: { ar: "أصغر مشروع ممكن تعملوه؟", en: "What's the smallest project you take?" },
    keywords: {
      ar: ["اصغر مشروع", "اقل حجم", "موقع بسيط جدا", "صفحة واحدة بس"],
      en: ["smallest project", "minimum size", "very simple site", "single page only"],
    },
    text: {
      ar: "بنعمل حتى المواقع البسيطة من صفحة واحدة، وده أساساً نقطة البداية عندنا من 700 جنيه.",
      en: "We take on even simple single-page sites — that's actually our starting point at 700 EGP.",
    },
  },
  {
    id: "installments",
    label: { ar: "ممكن أدفع على دفعات؟", en: "Can I pay in installments?" },
    keywords: {
      ar: ["تقسيط", "دفعات", "ادفع على مرتين", "نص المبلغ الأول"],
      en: ["installments", "pay in stages", "split payment", "half now half later"],
    },
    text: {
      ar: "أيوه، غالباً بنقسم الدفع على مراحل (جزء عند البدء وباقي عند التسليم مثلاً)، والتفاصيل بتتحدد معاك حسب حجم المشروع.",
      en: "Yes, we usually split payment across stages (part at the start and the rest at delivery, for example), with the details agreed based on your project's size.",
    },
  },
  {
    id: "source_code_ownership",
    label: { ar: "الموقع بيبقى ملكي بالكامل؟", en: "Do I fully own the website?" },
    keywords: {
      ar: ["الكود بتاعي", "املك الموقع", "ملكية الموقع", "بعد التسليم بيبقى ليا", "ملك"],
      en: ["own the code", "ownership", "who owns the site", "is it mine", "own", "fully own"],
    },
    text: {
      ar: "أيوه، بعد التسليم النهائي الموقع والدومين بيبقوا ملكك بالكامل، وتقدر تتصرف فيهم زي ما تحب.",
      en: "Yes, after final delivery the website and domain are fully yours, and you can do whatever you want with them.",
    },
  },
  {
    id: "switch_developer",
    label: { ar: "أقدر أنقل الموقع لمبرمج تاني بعدين؟", en: "Can I move to another developer later?" },
    keywords: {
      ar: ["مبرمج تاني بعدين", "انقل الموقع", "لو عايز اسيبكم"],
      en: ["another developer later", "move the site elsewhere", "switch developers"],
    },
    text: {
      ar: "أيوه، بما إن الموقع ملكك بالكامل بعد التسليم، تقدر تاخده لأي مبرمج أو فريق تاني وقت ما تحب من غير أي قيود.",
      en: "Yes, since the site is fully yours after delivery, you can take it to any other developer or team whenever you want, with no restrictions.",
    },
  },
  {
    id: "training",
    label: { ar: "هتعلموني استخدم الموقع؟", en: "Will you show me how to use the site?" },
    keywords: {
      ar: ["تعلموني", "ازاي استخدم الموقع", "شرح استخدام"],
      en: ["how to use the site", "training", "walk me through it", "tutorial"],
    },
    text: {
      ar: "أيوه، بعد التسليم بنوريك إزاي تستخدم أي أدوات أو لوحة تحكم موجودة في موقعك، عشان تكون مرتاح تتعامل معاه بنفسك.",
      en: "Yes, after delivery we walk you through using any tools or admin panel on your site, so you're comfortable handling it yourself.",
    },
  },
  {
    id: "downtime_reliability",
    label: { ar: "لو الموقع وقع، بتتصرفوا إزاي؟", en: "What if the site goes down?" },
    keywords: {
      ar: ["الموقع وقع", "الموقع مش شغال", "توقف الموقع", "داون تايم"],
      en: ["site is down", "goes down", "downtime", "site not working", "uptime"],
    },
    text: {
      ar: "الاستقرار العام بيعتمد على شركة الاستضافة نفسها، لكن بنبني الموقع بشكل يقلل المشاكل، وبنساعدك تتواصل مع الاستضافة أو نصلح أي مشكلة برمجية تظهر.",
      en: "Overall uptime depends on the hosting provider itself, but we build the site to minimize issues, and we help you reach the host or fix any code-related problem that comes up.",
    },
  },
  {
    id: "migrate_platform",
    label: { ar: "تقدروا تنقلوا موقعي من منصة تانية؟", en: "Can you migrate my site from another platform?" },
    keywords: {
      ar: ["انقل موقعي", "عندي موقع علي منصه تانيه", "ويكس", "وردبريس عايز اسيبه"],
      en: ["migrate from wix", "move from wordpress", "switch platforms", "migrate my site"],
    },
    text: {
      ar: "أيوه، نقدر ناخد فكرة وشكل موقعك الحالي (سواء ويكس، ووردبريس، أو غيره) ونعيد بناءه بكود مخصص أسرع وأكثر تحكماً.",
      en: "Yes, we can take your current site's idea and look (whether it's Wix, WordPress, or anything else) and rebuild it with custom code that's faster and gives you more control.",
    },
  },
  {
    id: "email_setup",
    label: { ar: "تقدروا تعملوا إيميل احترافي للشركة؟", en: "Can you set up a professional business email?" },
    keywords: {
      ar: ["ايميل الشركة", "بريد احترافي", "ايميل بدومين الشركة", "ايميل احترافي", "ايميل"],
      en: ["business email", "professional email", "email on my domain"],
    },
    text: {
      ar: "أيوه، نقدر نساعدك تعمل بريد إلكتروني احترافي بنفس اسم الدومين بتاعك (زي info@موقعك.com)، والتفاصيل بتتحدد حسب مزود الخدمة اللي هتختاره.",
      en: "Yes, we can help you set up a professional email on your own domain (like info@yoursite.com) — details depend on the provider you choose.",
    },
  },
  {
    id: "branding_logo",
    label: { ar: "بتعملوا لوجو أو هوية بصرية؟", en: "Do you design logos or branding?" },
    keywords: {
      ar: ["لوجو", "هويه بصريه", "تصميم شعار", "براندنج"],
      en: ["logo design", "logo", "branding", "visual identity", "brand kit"],
    },
    text: {
      ar: "تخصصنا الأساسي هو تصميم وبرمجة المواقع، مش تصميم الهوية البصرية، لكن نقدر نتناقش لو محتاج شعار بسيط كجزء من مشروع الموقع.",
      en: "Our core focus is website design and development, not branding — but we can discuss a simple logo if you need one as part of the site project.",
    },
  },
  {
    id: "privacy_terms_pages",
    label: { ar: "تقدروا تضيفوا صفحة الخصوصية والشروط؟", en: "Can you add privacy and terms pages?" },
    keywords: {
      ar: ["سياسه الخصوصيه", "الشروط والاحكام", "صفحة الخصوصية"],
      en: ["privacy policy", "terms and conditions", "terms of service"],
    },
    text: {
      ar: "أيوه، نقدر نضيف صفحات زي سياسة الخصوصية والشروط والأحكام لموقعك لو محتاجها، خصوصاً لو الموقع بيجمع بيانات العملاء أو بيبيع منتجات.",
      en: "Yes, we can add pages like a privacy policy and terms of service to your site if you need them, especially if it collects customer data or sells products.",
    },
  },
  {
    id: "accessibility",
    label: { ar: "الموقع بيراعي ذوي الهمم؟", en: "Is the site accessible?" },
    keywords: {
      ar: ["ذوي الهمم", "اعاقه بصريه", "قارئ الشاشه"],
      en: ["accessibility", "accessible", "screen reader", "disability", "a11y"],
    },
    text: {
      ar: "بنراعي أساسيات إمكانية الوصول (تباين ألوان واضح، نصوص بديلة للصور، ترتيب منطقي للعناصر) في كل موقع بنبنيه.",
      en: "We follow accessibility basics (clear color contrast, alt text for images, logical element order) in every site we build.",
    },
  },
  {
    id: "analytics_reports",
    label: { ar: "أقدر أشوف عدد زوار موقعي؟", en: "Can I see how many visitors my site gets?" },
    keywords: {
      ar: ["عدد الزوار", "احصائيات الموقع", "تقارير الزوار", "تتبع الزيارات", "زوار"],
      en: ["visitor stats", "analytics", "traffic report", "track visitors"],
    },
    text: {
      ar: "أيوه، نقدر نربط موقعك بأداة تحليلات بسيطة تورّيك عدد الزوار ومصدرهم من غير ما تأثر على سرعة أو خصوصية الموقع.",
      en: "Yes, we can connect your site to a lightweight analytics tool that shows visitor counts and sources without hurting site speed or privacy.",
    },
  },
  {
    id: "ai_features",
    label: { ar: "الشات بوت ده ذكاء اصطناعي؟", en: "Is this chatbot AI?" },
    keywords: {
      ar: ["الشات بوت ده ذكاء اصطناعي", "بتستخدموا ai", "شات جي بي تي"],
      en: ["is this ai", "chatgpt", "artificial intelligence", "is the chatbot ai", "chatbot ai"],
    },
    text: {
      ar: "لأ، الشات بوت ده مبني على قاعدة أسئلة وأجوبة جاهزة ومحدثة باستمرار — مش موديل ذكاء اصطناعي مدفوع — عشان يفضل مجاني وسريع ودقيق في إجاباته عن STRATIX تحديداً.",
      en: "No, this chatbot runs on a continuously updated set of fixed questions and answers — not a paid AI model — so it stays free, fast, and accurate specifically about STRATIX.",
    },
  },
  {
    id: "services",
    label: { ar: "الشركة بتعمل ايه؟", en: "What does the company do?" },
    keywords: {
      // "تعملوا" deliberately omitted — "تعمل" already substring-matches it,
      // and keeping both double-counts the same hit, letting this generic
      // verb outweigh more specific intents phrased as "بتعملوا X؟".
      ar: ["خدم", "شرك", "اعمال", "تصميم", "برمج", "تعمل", "شغل", "شغلكم", "مين انتوا", "تخصص", "بتقدموا ايه", "بتشتغلوا في ايه"],
      en: ["service", "design", "develop", "company", "offer", "personal", "what do you do", "who are you", "what is stratix"],
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
      ar: ["سعر", "اسعار", "تكلف", "كام", "بكام", "ميزاني", "700", "فصال", "مفاصل", "تمن", "التسعيره", "هيكلفني كام"],
      en: ["price", "cost", "pricing", "how much", "budget", "negotiat", "700", "quote", "rates"],
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
      ar: ["مده", "وقت", "اسبوع", "تسليم", "يخلص", "تنفيذ", "امتى هيخلص", "هياخد وقت قد ايه"],
      en: ["duration", "time", "week", "deliver", "how long", "timeline", "turnaround", "eta"],
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
      ar: ["حجز", "احجز", "ابدأ", "طلب", "اتفق", "مشروع", "عايز اطلب", "عايز ابدأ معاكم"],
      en: ["book", "booking", "start", "order", "request", "project", "sign up", "get started"],
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
      ar: ["تواصل", "رقم", "هاتف", "تليفون", "واتس", "كلم", "اتصال", "الايميل بتاعكم", "الميل"],
      en: ["contact", "phone", "number", "whatsapp", "call", "reach", "email address", "get in touch"],
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
      ar: ["مؤسس", "موسس", "فارس", "يوسف", "فريق", "صاحب", "الشركه ملك مين"],
      en: ["founder", "fares", "youssef", "team", "owner", "who runs stratix"],
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
      ar: ["تقنيه", "تكنولوجيا", "برمجه", "برمجة", "ووردبريس", "كود", "لغة برمجة", "بتشتغلوا بايه"],
      en: ["technology", "tech stack", "wordpress", "code", "platform", "built with", "coded", "framework", "programming language"],
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
      ar: ["متجر", "متاجر", "تجاره", "تجارة", "بيع", "منتجات", "اونلاين", "كوميرس", "الكترونيه", "الكترونية", "عايز ابيع اونلاين"],
      en: ["store", "stores", "shop", "ecommerce", "e-commerce", "sell", "products", "cart", "shopify", "checkout"],
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
      ar: ["موقع موجود", "اعاده تصميم", "إعادة تصميم", "تطوير موقع", "عندي موقع", "الموقع بتاعي قديم"],
      en: ["redesign", "existing website", "already have a site", "revamp", "outdated site"],
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
      ar: ["محتوى", "نصوص", "اكتب", "صور الموقع", "محتاج حد يكتبلي"],
      en: ["content", "copywriting", "who writes", "text for the site", "who provides the copy"],
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
      ar: ["جوجل", "سيو", "بحث", "ظهور", "نتائج البحث", "ترتيب في جوجل"],
      en: ["google", "seo", "search", "ranking", "show up", "organic traffic"],
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
      ar: ["موبايل", "تليفون", "شاشات", "متجاوب", "بيفتح كويس علي الموبايل"],
      en: ["mobile", "phone", "responsive", "tablet", "mobile friendly", "smartphone"],
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
      ar: ["دومين", "استضافه", "استضافة", "هوستنج", "اسم الموقع", "عايز دومين"],
      en: ["domain", "hosting", "server", "domain name", "buy a domain", "web host"],
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
      ar: ["دفع", "ادفع", "عربون", "مقدم", "فلوس", "تحويل", "فودافون كاش", "انستاباي", "طريقة الدفع"],
      en: ["payment", "pay", "deposit", "upfront", "money", "transfer", "vodafone cash", "instapay", "bank transfer"],
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
      ar: ["تعديل", "تعديلات", "تغيير", "عدل", "كام تعديل باقيلي"],
      en: ["revision", "revisions", "change", "edit", "edits", "how many revisions", "unlimited revisions"],
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
      ar: ["صيانه", "صيانة", "دعم", "بعد الاطلاق", "مشكله بعدين", "لو حصل مشكله في الموقع"],
      en: ["maintenance", "support", "after launch", "ongoing", "if something breaks", "bug fix"],
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
      ar: ["امن", "امان", "حماي", "سريع", "اداء", "طلبات", "سيرفر", "حمايه من الهكرز", "قاعدة بيانات"],
      en: ["secure", "security", "protect", "fast", "performance", "load", "server", "hackers", "data protection", "ssl"],
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
