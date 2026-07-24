import { useRef } from "react";
import type { FormEvent, ReactNode } from "react";
import StratixChat from "@/components/StratixChat";
import WhatsAppButton from "@/components/WhatsAppButton";
import { trpc } from "@/lib/trpc";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpLeft,
  CalendarDays,
  Code2,
  Gauge,
  Layers3,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

const founders = [
  { index: "01", name: "فارس سامي عبد العزيز السيد", role: "مؤسس مشارك" },
  { index: "02", name: "يوسف تامر السيد أحمد", role: "مؤسس مشارك" },
];

const processSteps = [
  {
    index: "01",
    title: "نفهم الفكرة",
    text: "نرتب هدف المشروع والجمهور والوظائف المطلوبة قبل لمس أي سطر كود.",
  },
  {
    index: "02",
    title: "نبني التجربة",
    text: "نصمم واجهة لها شخصية ثم نحولها إلى موقع سريع ومتجاوب وواضح.",
  },
  {
    index: "03",
    title: "نطلق بثقة",
    text: "نراجع الأداء والأمان والتفاصيل الدقيقة، ثم نجهز المشروع للانطلاق.",
  },
];

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 44 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{
        duration: reduceMotion ? 0 : 0.78,
        delay: reduceMotion ? 0 : delay,
        ease: [0.23, 1, 0.32, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
    </span>
  );
}

export default function Home() {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const heroWordY = useTransform(scrollYProgress, [0, 0.28], [0, -120]);
  const orbitY = useTransform(scrollYProgress, [0, 0.32], [0, 160]);
  const bookingRequestKey = useRef(crypto.randomUUID());
  const bookingMutation = trpc.booking.submit.useMutation();

  const handleBookingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const result = await bookingMutation.mutateAsync({
        requestKey: bookingRequestKey.current,
        name: String(data.get("name") ?? ""),
        phone: String(data.get("phone") ?? ""),
        clientEmail: String(data.get("clientEmail") ?? ""),
        projectType: String(data.get("projectType") ?? "") as "company" | "portfolio" | "landing" | "other",
        budget: String(data.get("budget") ?? "") as "700-1500" | "1500-3000" | "3000+",
        details: String(data.get("details") ?? ""),
        website: String(data.get("website") ?? ""),
      });

      form.reset();
      bookingRequestKey.current = crypto.randomUUID();
      toast.success("تم استلام طلبك بنجاح", {
        description: `رقم الطلب: ${result.publicId} — سنتواصل معك قريباً.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر إرسال الطلب الآن.";
      toast.error("لم يكتمل إرسال الطلب", { description: message });
    }
  };

  return (
    <AnimatePresence mode="wait">
      <div className="site-shell">
        <motion.div
          className="scroll-progress"
          style={{ scaleX: scrollYProgress }}
          aria-hidden="true"
        />
        <div className="signal-spine" aria-hidden="true" />

        <header className="site-header" aria-label="التنقل الرئيسي">
          <a className="logo-lockup" href="#top" aria-label="STRATIX — الرئيسية">
            <BrandMark />
            <span className="logo-word" dir="ltr">STRATIX</span>
          </a>

          <nav className="main-nav" aria-label="أقسام الموقع">
            <a href="#services">الخدمات</a>
            <a href="#process">طريقتنا</a>
            <a href="#founders">المؤسسون</a>
          </nav>

          <a className="nav-cta" href="#booking">
            ابدأ مشروعك
            <ArrowUpLeft aria-hidden="true" />
          </a>
        </header>

        <main>
          <section id="top" className="hero-section section-grid" aria-labelledby="hero-title">
            <div className="hero-grid-lines" aria-hidden="true" />
            <div className="hero-signal" aria-hidden="true">
              <span /> متاحون لمشروع جديد
            </div>

            <motion.div
              className="hero-orbit"
              style={{ y: reduceMotion ? 0 : orbitY }}
              aria-hidden="true"
            >
              <motion.div
                className="orbit-ring orbit-ring-outer"
                animate={reduceMotion ? undefined : { rotate: 360 }}
                transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="orbit-ring orbit-ring-inner"
                animate={reduceMotion ? undefined : { rotate: -360 }}
                transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
              />
              <span className="orbit-core">S</span>
            </motion.div>

            <motion.div
              className="hero-title-block"
              style={{ y: reduceMotion ? 0 : heroWordY }}
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.11, delayChildren: 0.15 } },
              }}
            >
              <motion.p
                className="eyebrow"
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0, transition: { duration: 0.55 } },
                }}
              >
                DIGITAL ARCHITECTURE / CAIRO
              </motion.p>

              <div className="hero-word-mask" dir="ltr">
                <motion.h1
                  id="hero-title"
                  className="hero-word"
                  variants={{
                    hidden: { opacity: 0, y: "105%" },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 1.05, ease: [0.16, 1, 0.3, 1] },
                    },
                  }}
                >
                  STRA<span>TIX</span>
                </motion.h1>
              </div>

              <motion.div
                className="hero-statement"
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.7, ease: [0.23, 1, 0.32, 1] },
                  },
                }}
              >
                <h2>
                  مواقع لا تمرّ
                  <br />
                  <em>مروراً عابراً.</em>
                </h2>
                <div className="hero-summary">
                  <p>
                    نصمم ونبرمج تجارب ويب سريعة، متحركة، ومصنوعة لتمنح فكرتك حضوراً
                    لا يمكن تجاهله.
                  </p>
                  <div className="hero-actions">
                    <a className="button button-primary" href="#booking">
                      احجز مشروعك
                      <ArrowDownLeft aria-hidden="true" />
                    </a>
                    <a className="text-link" href="#services">
                      اكتشف الخدمة
                      <span aria-hidden="true">↙</span>
                    </a>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            <div className="hero-meta" aria-label="معلومات سريعة">
              <div>
                <span>نقطة البداية</span>
                <strong>700 ج.م</strong>
              </div>
              <div>
                <span>المدة المتوقعة</span>
                <strong>أسبوع</strong>
              </div>
              <div className="hero-meta-line" aria-hidden="true" />
            </div>

            <a className="scroll-cue" href="#manifesto" aria-label="انتقل إلى القسم التالي">
              <span>مرّر لاكتشاف المزيد</span>
              <ArrowDownLeft aria-hidden="true" />
            </a>
          </section>

          <section id="manifesto" className="manifesto-section section-grid">
            <Reveal className="section-index">01 / الرؤية</Reveal>
            <Reveal className="manifesto-copy">
              <p className="oversized-quote">
                لا نبني <span>صفحات.</span>
                <br />
                نبني انطباعاً يعمل.
              </p>
            </Reveal>
            <Reveal className="manifesto-note" delay={0.12}>
              <Sparkles aria-hidden="true" />
              <p>
                كل حركة لها سبب، وكل سطر يقود الزائر نحو قرار واضح. النتيجة موقع له
                شخصية ويخدم هدف مشروعك فعلاً.
              </p>
            </Reveal>
          </section>

          <div className="kinetic-strip" aria-hidden="true" dir="ltr">
            <motion.div
              className="kinetic-track"
              animate={reduceMotion ? undefined : { x: ["0%", "-50%"] }}
              transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            >
              <span>SPEED</span><i>•</i><span>MOTION</span><i>•</i><span>TRUST</span><i>•</i><span>SCALE</span><i>•</i>
              <span>SPEED</span><i>•</i><span>MOTION</span><i>•</i><span>TRUST</span><i>•</i><span>SCALE</span><i>•</i>
            </motion.div>
          </div>

          <section id="services" className="service-section section-grid" aria-labelledby="service-title">
            <Reveal className="section-index section-index-dark">02 / الخدمة</Reveal>

            <Reveal className="service-heading">
              <p className="eyebrow eyebrow-dark">ONE FOCUSED SERVICE</p>
              <h2 id="service-title">
                نصنع موقعك
                <br />
                <span>من الفكرة للإطلاق.</span>
              </h2>
            </Reveal>

            <Reveal className="price-stage" delay={0.08}>
              <div className="price-orbit-label">يبدأ من</div>
              <div className="price-number" dir="ltr">
                700<sup>+</sup>
              </div>
              <div className="price-currency">جنيه مصري</div>
              <p>سعر ثابت بدون مفاصلة، ويزيد فقط حسب حجم المشروع والوظائف المطلوبة.</p>
            </Reveal>

            <div className="capability-list">
              <Reveal className="capability-row" delay={0.05}>
                <Code2 aria-hidden="true" />
                <div><strong>تطوير احترافي</strong><span>كود نظيف وتجربة متجاوبة</span></div>
                <span className="capability-index">A1</span>
              </Reveal>
              <Reveal className="capability-row" delay={0.1}>
                <Gauge aria-hidden="true" />
                <div><strong>أداء محسوب</strong><span>سرعة ووضوح في كل شاشة</span></div>
                <span className="capability-index">A2</span>
              </Reveal>
              <Reveal className="capability-row" delay={0.15}>
                <Layers3 aria-hidden="true" />
                <div><strong>حركة لها معنى</strong><span>انتقالات تقود العين ولا تشتتها</span></div>
                <span className="capability-index">A3</span>
              </Reveal>
              <Reveal className="capability-row" delay={0.2}>
                <ShieldCheck aria-hidden="true" />
                <div><strong>أساس آمن</strong><span>تحقق وحماية لبيانات التواصل</span></div>
                <span className="capability-index">A4</span>
              </Reveal>
            </div>
          </section>

          <section id="process" className="process-section section-grid" aria-labelledby="process-title">
            <Reveal className="section-index">03 / الطريقة</Reveal>
            <Reveal className="process-intro">
              <p className="eyebrow">ONE WEEK / CLEAR TRACK</p>
              <h2 id="process-title">أسبوع واحد.<br /><span>مسار واضح.</span></h2>
              <p>
                المدة المتوقعة للمشروعات المناسبة للنطاق الأساسي هي أسبوع، وقد تختلف
                للمشروعات الأكبر بعد تحديد المتطلبات.
              </p>
            </Reveal>

            <div className="process-steps">
              {processSteps.map((step, position) => (
                <Reveal className="process-step" delay={position * 0.1} key={step.index}>
                  <div className="step-topline">
                    <span>{step.index}</span>
                    <ArrowLeft aria-hidden="true" />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </Reveal>
              ))}
            </div>
          </section>

          <section id="founders" className="founders-section" aria-labelledby="founders-title">
            <div className="founders-angle" aria-hidden="true" />
            <div className="founders-content section-grid">
              <Reveal className="section-index section-index-dark">04 / تعرف علينا</Reveal>
              <Reveal className="founders-intro">
                <p className="eyebrow eyebrow-dark">GET TO KNOW US</p>
                <h2 id="founders-title">تعرف علينا</h2>
                <p>
                  بدأت STRATIX من ملاحظة بسيطة: عشرات أصحاب المشروعات والأفكار
                  عندهم خدمة أو منتج قوي، لكن يوقفهم موقع غير واضح أو غير
                  موجود من الأساس. جمعنا شغفنا بالتكنولوجيا مع حسّنا في بناء
                  تجربة تخدم هدف العميل فعلاً، وقررنا نبني استوديو صغير يحوّل
                  الفكرة إلى موقع احترافي بسرعة وبثقة، بدل القوالب الجاهزة
                  والحلول المكررة.
                </p>
              </Reveal>

              <div className="founder-list">
                {founders.map((founder, position) => (
                  <Reveal className="founder-row" delay={position * 0.12} key={founder.index}>
                    <span className="founder-index">{founder.index}</span>
                    <div>
                      <h3>{founder.name}</h3>
                      <p>{founder.role}</p>
                    </div>
                    <BrandMark />
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          <section id="booking" className="booking-section section-grid" aria-labelledby="booking-title">
            <Reveal className="section-index">05 / الحجز</Reveal>
            <Reveal className="booking-intro">
              <p className="eyebrow">START SOMETHING REAL</p>
              <h2 id="booking-title">
                عندك فكرة؟
                <br />
                <em>خلّيها تتحرك.</em>
              </h2>
              <p>
                اترك بياناتك ووصفاً بسيطاً للمشروع، وسنتواصل معك لمراجعة التفاصيل
                وتحديد السعر النهائي.
              </p>

              <div className="contact-mini-list">
                <a href="tel:+201125839109" dir="ltr"><Phone aria-hidden="true" /> 011 2583 9109</a>
                <a href="tel:+201036678093" dir="ltr"><Phone aria-hidden="true" /> 010 3667 8093</a>
                <a href="mailto:stratix255@gmail.com" dir="ltr"><Mail aria-hidden="true" /> stratix255@gmail.com</a>
                <a href="https://wa.me/201125839109" target="_blank" rel="noreferrer" dir="ltr">
                  <MessageCircle aria-hidden="true" /> واتساب
                </a>
              </div>
            </Reveal>

            <Reveal className="booking-panel" delay={0.12}>
              <div className="booking-panel-top">
                <div><CalendarDays aria-hidden="true" /><span>طلب مشروع جديد</span></div>
                <span className="secure-label"><i /> اتصال آمن</span>
              </div>

              <form className="booking-form" onSubmit={handleBookingSubmit} aria-busy={bookingMutation.isPending}>
                <label className="booking-website-field" aria-hidden="true">
                  <span>الموقع الإلكتروني</span>
                  <input name="website" type="text" tabIndex={-1} autoComplete="off" />
                </label>
                <label>
                  <span>الاسم</span>
                  <input name="name" type="text" placeholder="اكتب اسمك" autoComplete="name" minLength={2} maxLength={80} required />
                </label>
                <label>
                  <span>رقم الهاتف</span>
                  <input name="phone" type="tel" placeholder="01xxxxxxxxx" autoComplete="tel" inputMode="tel" dir="ltr" maxLength={16} required />
                </label>
                <label className="form-span-2">
                  <span>البريد الإلكتروني <small>(اختياري)</small></span>
                  <input name="clientEmail" type="email" placeholder="name@example.com" autoComplete="email" inputMode="email" dir="ltr" maxLength={320} />
                </label>
                <label>
                  <span>نوع الموقع</span>
                  <select name="projectType" defaultValue="" required>
                    <option value="" disabled>اختر النوع</option>
                    <option value="company">موقع شركة</option>
                    <option value="portfolio">ملف أعمال</option>
                    <option value="landing">صفحة هبوط</option>
                    <option value="other">فكرة أخرى</option>
                  </select>
                </label>
                <label>
                  <span>الميزانية المتوقعة</span>
                  <select name="budget" defaultValue="" required>
                    <option value="" disabled>اختر النطاق</option>
                    <option value="700-1500">700 — 1,500 جنيه</option>
                    <option value="1500-3000">1,500 — 3,000 جنيه</option>
                    <option value="3000+">أكثر من 3,000 جنيه</option>
                  </select>
                </label>
                <label className="form-span-2">
                  <span>ملاحظات <small>(اختياري)</small></span>
                  <textarea name="details" placeholder="احكِ لنا عن فكرتك إن حبيت" rows={4} minLength={15} maxLength={2000} />
                </label>
                <button className="submit-button form-span-2" type="submit" disabled={bookingMutation.isPending}>
                  <span>{bookingMutation.isPending ? "جارٍ تأمين وإرسال الطلب…" : "إرسال طلب الحجز"}</span>
                  <ArrowUpLeft aria-hidden="true" />
                </button>
                <p
                  className="form-status form-span-2"
                  data-state={bookingMutation.isError ? "error" : bookingMutation.isSuccess ? "success" : "idle"}
                  aria-live="polite"
                >
                  {bookingMutation.isError
                    ? "راجع البيانات أو حاول مرة أخرى بعد قليل."
                    : bookingMutation.isSuccess
                      ? `تم حفظ الطلب ${bookingMutation.data.publicId} بنجاح.`
                      : "تُستخدم بياناتك للتواصل بشأن المشروع فقط، ولا نشاركها مع جهات أخرى."}
                </p>
              </form>
            </Reveal>
          </section>
        </main>

        <footer className="site-footer section-grid">
          <div className="footer-logo" dir="ltr">STRATIX<span>®</span></div>
          <p>مواقع تتحرك بقوة فكرتك.</p>
          <div className="footer-links">
            <a href="#top">أعلى الصفحة</a>
            <a href="#booking">احجز الآن</a>
          </div>
          <p className="footer-note">© 2026 STRATIX. جميع الحقوق محفوظة.</p>
        </footer>
        <StratixChat />
        <WhatsAppButton />
      </div>
    </AnimatePresence>
  );
}
