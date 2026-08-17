import { useRef } from "react";
import type { FormEvent, ReactNode } from "react";
import PhoneField from "@/components/PhoneField";
import SplashScreen from "@/components/SplashScreen";
import StratixChat from "@/components/StratixChat";
import WhatsAppButton from "@/components/WhatsAppButton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLitePerformance, useOnScreen } from "@/hooks/useLitePerformance";
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
  Languages,
  Layers3,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

function Reveal({
  children,
  className = "",
  delay = 0,
  dir,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  dir?: "rtl" | "ltr";
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      dir={dir}
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
  const lite = useLitePerformance();
  const { t, toggleLanguage, language } = useLanguage();
  const { scrollYProgress } = useScroll();
  const heroWordY = useTransform(scrollYProgress, [0, 0.28], [0, -120]);
  const orbitY = useTransform(scrollYProgress, [0, 0.32], [0, 160]);
  const bookingRequestKey = useRef(crypto.randomUUID());
  const bookingMutation = trpc.booking.submit.useMutation();

  // The orbit rings and the marquee loop forever. Left unchecked they keep the
  // compositor busy even when scrolled far away, which is what makes the page
  // feel heavy on cheap phones. Run them only while actually on screen, and
  // not at all on low-power devices.
  const orbitRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const orbitOnScreen = useOnScreen(orbitRef);
  const stripOnScreen = useOnScreen(stripRef);
  const allowMotion = !reduceMotion && !lite;
  const spinOrbit = allowMotion && orbitOnScreen;
  const spinStrip = allowMotion && stripOnScreen;

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
        projectType: String(data.get("projectType") ?? "") as "company" | "personal" | "other",
        budget: String(data.get("budget") ?? "") as "700-1500" | "1500-3000" | "3000+",
        details: String(data.get("details") ?? ""),
        website: String(data.get("website") ?? ""),
        language,
      });

      form.reset();
      bookingRequestKey.current = crypto.randomUUID();
      toast.success(t.booking.toastSuccessTitle, {
        description: t.booking.toastSuccessDesc(result.publicId),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t.booking.toastErrorFallback;
      toast.error(t.booking.toastErrorTitle, { description: message });
    }
  };

  return (
    <>
      <SplashScreen />
      <AnimatePresence mode="wait">
      <div className="site-shell">
        <motion.div
          className="scroll-progress"
          style={{ scaleX: scrollYProgress }}
          aria-hidden="true"
        />
        <div className="signal-spine" aria-hidden="true" />

        <header className="site-header" aria-label={t.nav.headerAria}>
          <a className="logo-lockup" href="#top" aria-label={t.nav.logoAria}>
            <BrandMark />
            <span className="logo-word" dir="ltr">STRATIX</span>
          </a>

          <nav className="main-nav" aria-label={t.nav.navAria}>
            <a href="#services">{t.nav.services}</a>
            <a href="#process">{t.nav.process}</a>
            <a href="#founders">{t.nav.founders}</a>
          </nav>

          <div className="nav-actions">
            <button
              type="button"
              className="lang-toggle"
              onClick={toggleLanguage}
              aria-label={t.nav.langToggleAria}
            >
              <Languages aria-hidden="true" />
              <span>{t.nav.langToggle}</span>
            </button>
            <a className="nav-cta" href="#booking">
              {t.nav.cta}
              <ArrowUpLeft aria-hidden="true" />
            </a>
          </div>
        </header>

        <main>
          <section id="top" className="hero-section section-grid" aria-labelledby="hero-title">
            <div className="hero-grid-lines" aria-hidden="true" />
            <div className="hero-signal" aria-hidden="true">
              <span /> {t.hero.signal}
            </div>

            <motion.div
              ref={orbitRef}
              className="hero-orbit"
              style={{ y: reduceMotion ? 0 : orbitY }}
              aria-hidden="true"
            >
              <motion.div
                className="orbit-ring orbit-ring-outer"
                animate={spinOrbit ? { rotate: 360 } : undefined}
                transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="orbit-ring orbit-ring-inner"
                animate={spinOrbit ? { rotate: -360 } : undefined}
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
                {t.hero.eyebrow}
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
                dir={t.dir}
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
                  {t.hero.statementTitle1}
                  <br />
                  <em>{t.hero.statementTitle2}</em>
                </h2>
                <div className="hero-summary">
                  <p>{t.hero.summary}</p>
                  <div className="hero-actions">
                    <a className="button button-primary" href="#booking">
                      {t.hero.bookCta}
                      <ArrowDownLeft aria-hidden="true" />
                    </a>
                    <a className="text-link" href="#services">
                      {t.hero.discoverCta}
                      <span aria-hidden="true">↙</span>
                    </a>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            <div className="hero-meta" aria-label={t.hero.metaAria}>
              <div>
                <span>{t.hero.metaStartLabel}</span>
                <strong>{t.hero.metaStartValue}</strong>
              </div>
              <div>
                <span>{t.hero.metaDurationLabel}</span>
                <strong>{t.hero.metaDurationValue}</strong>
              </div>
              <div className="hero-meta-line" aria-hidden="true" />
            </div>

            <a className="scroll-cue" href="#manifesto" aria-label={t.hero.scrollAria}>
              <span>{t.hero.scrollCue}</span>
              <ArrowDownLeft aria-hidden="true" />
            </a>
          </section>

          <section id="manifesto" className="manifesto-section section-grid">
            <Reveal className="section-index">{t.manifesto.index}</Reveal>
            <Reveal className="manifesto-copy" dir={t.dir}>
              <p className="oversized-quote">
                {t.manifesto.quote1}
                <span>{t.manifesto.quoteHighlight}</span>
                <br />
                {t.manifesto.quote2}
              </p>
            </Reveal>
            <Reveal className="manifesto-note" delay={0.12} dir={t.dir}>
              <Sparkles aria-hidden="true" />
              <p>{t.manifesto.note}</p>
            </Reveal>
          </section>

          <div className="kinetic-strip" ref={stripRef} aria-hidden="true" dir="ltr">
            <motion.div
              className="kinetic-track"
              animate={spinStrip ? { x: ["0%", "-50%"] } : undefined}
              transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            >
              <span>SPEED</span><i>•</i><span>MOTION</span><i>•</i><span>TRUST</span><i>•</i><span>SCALE</span><i>•</i>
              <span>SPEED</span><i>•</i><span>MOTION</span><i>•</i><span>TRUST</span><i>•</i><span>SCALE</span><i>•</i>
            </motion.div>
          </div>

          <section id="services" className="service-section section-grid" aria-labelledby="service-title">
            <Reveal className="section-index section-index-dark">{t.services.index}</Reveal>

            <Reveal className="service-heading" dir={t.dir}>
              <p className="eyebrow eyebrow-dark">{t.services.eyebrow}</p>
              <h2 id="service-title">
                {t.services.title1}
                <br />
                <span>{t.services.title2}</span>
              </h2>
            </Reveal>

            <Reveal className="price-stage" delay={0.08} dir={t.dir}>
              <div className="price-orbit-label">{t.services.priceLabel}</div>
              <div className="price-headline">{t.services.priceHeadline}</div>
              <div className="price-currency">{t.services.priceCurrency}</div>
              <p>{t.services.priceNote}</p>
            </Reveal>

            <div className="capability-list">
              {[Code2, Gauge, Layers3, ShieldCheck].map((Icon, position) => {
                const capability = t.services.capabilities[position];
                return (
                  <Reveal className="capability-row" delay={0.05 + position * 0.05} key={capability.title}>
                    <Icon aria-hidden="true" />
                    <div><strong>{capability.title}</strong><span>{capability.text}</span></div>
                    <span className="capability-index">{`A${position + 1}`}</span>
                  </Reveal>
                );
              })}
            </div>
          </section>

          <section id="process" className="process-section section-grid" aria-labelledby="process-title">
            <Reveal className="section-index">{t.process.index}</Reveal>
            <Reveal className="process-intro" dir={t.dir}>
              <p className="eyebrow">{t.process.eyebrow}</p>
              <h2 id="process-title">{t.process.title1}<br /><span>{t.process.title2}</span></h2>
              <p>{t.process.intro}</p>
            </Reveal>

            <div className="process-steps">
              {t.process.steps.map((step, position) => (
                <Reveal className="process-step" delay={position * 0.1} key={step.title} dir={t.dir}>
                  <div className="step-topline">
                    <span>{String(position + 1).padStart(2, "0")}</span>
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
              <Reveal className="section-index section-index-dark">{t.founders.index}</Reveal>
              <Reveal className="founders-intro" dir={t.dir}>
                <p className="eyebrow eyebrow-dark">{t.founders.eyebrow}</p>
                <h2 id="founders-title">{t.founders.title}</h2>
                <p>{t.founders.story}</p>
              </Reveal>

              <div className="founder-list">
                {t.founders.list.map((founder, position) => (
                  <Reveal className="founder-row" delay={position * 0.12} key={founder.name} dir={t.dir}>
                    <span className="founder-index">{String(position + 1).padStart(2, "0")}</span>
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
            <Reveal className="section-index">{t.booking.index}</Reveal>
            <Reveal className="booking-intro" dir={t.dir}>
              <p className="eyebrow">{t.booking.eyebrow}</p>
              <h2 id="booking-title">
                {t.booking.title1}
                <br />
                <em>{t.booking.title2}</em>
              </h2>
              <p>{t.booking.intro}</p>

              <div className="contact-mini-list">
                <a href="tel:+201125839109" dir="ltr"><Phone aria-hidden="true" /> 011 2583 9109</a>
                <a href="tel:+201036678093" dir="ltr"><Phone aria-hidden="true" /> 010 3667 8093</a>
                <a href="mailto:stratix255@gmail.com" dir="ltr"><Mail aria-hidden="true" /> stratix255@gmail.com</a>
                <a href="https://wa.me/201125839109" target="_blank" rel="noreferrer" dir="ltr">
                  <MessageCircle aria-hidden="true" /> {t.booking.whatsappLabel}
                </a>
              </div>
            </Reveal>

            <Reveal className="booking-panel" delay={0.12} dir={t.dir}>
              <div className="booking-panel-top">
                <div><CalendarDays aria-hidden="true" /><span>{t.booking.panelTitle}</span></div>
                <span className="secure-label"><i /> {t.booking.secureLabel}</span>
              </div>

              <form className="booking-form" onSubmit={handleBookingSubmit} aria-busy={bookingMutation.isPending}>
                <label className="booking-website-field" aria-hidden="true">
                  <span>{t.booking.websiteLabel}</span>
                  <input name="website" type="text" tabIndex={-1} autoComplete="off" />
                </label>
                <label>
                  <span>{t.booking.nameLabel}</span>
                  <input name="name" type="text" placeholder={t.booking.namePlaceholder} autoComplete="name" minLength={2} maxLength={80} required />
                </label>
                <label>
                  <span>{t.booking.phoneLabel}</span>
                  <PhoneField />
                </label>
                <label className="form-span-2">
                  <span>{t.booking.emailLabel} <small>{t.booking.optional}</small></span>
                  <input name="clientEmail" type="email" placeholder={t.booking.emailPlaceholder} autoComplete="email" inputMode="email" dir="ltr" maxLength={320} />
                </label>
                <label>
                  <span>{t.booking.typeLabel}</span>
                  <select name="projectType" defaultValue="" required>
                    <option value="" disabled>{t.booking.typeSelect}</option>
                    <option value="company">{t.booking.typeCompany}</option>
                    <option value="personal">{t.booking.typePersonal}</option>
                    <option value="other">{t.booking.typeOther}</option>
                  </select>
                </label>
                <label>
                  <span>{t.booking.budgetLabel}</span>
                  {/* The values are legacy price bands from when a starting
                      price was published. The question now asks about project
                      size, smallest to largest in the same order, so the stored
                      values still sort correctly and old bookings stay valid —
                      only the labels changed. */}
                  <select name="budget" defaultValue="" required>
                    <option value="" disabled>{t.booking.budgetSelect}</option>
                    <option value="700-1500">{t.booking.budget1}</option>
                    <option value="1500-3000">{t.booking.budget2}</option>
                    <option value="3000+">{t.booking.budget3}</option>
                  </select>
                </label>
                <label className="form-span-2">
                  <span>{t.booking.detailsLabel} <small>{t.booking.optional}</small></span>
                  <textarea name="details" placeholder={t.booking.detailsPlaceholder} rows={4} minLength={15} maxLength={2000} />
                </label>
                <button className="submit-button form-span-2" type="submit" disabled={bookingMutation.isPending}>
                  <span>{bookingMutation.isPending ? t.booking.submitPending : t.booking.submitIdle}</span>
                  <ArrowUpLeft aria-hidden="true" />
                </button>
                <p
                  className="form-status form-span-2"
                  data-state={bookingMutation.isError ? "error" : bookingMutation.isSuccess ? "success" : "idle"}
                  aria-live="polite"
                >
                  {bookingMutation.isError
                    ? t.booking.statusError
                    : bookingMutation.isSuccess
                      ? t.booking.statusSuccess(bookingMutation.data.publicId)
                      : t.booking.statusIdle}
                </p>
              </form>
            </Reveal>
          </section>
        </main>

        <footer className="site-footer section-grid">
          <div className="footer-logo" dir="ltr">STRATIX<span>®</span></div>
          <p dir={t.dir}>{t.footer.tagline}</p>
          <div className="footer-links">
            <a href="#top">{t.footer.topLink}</a>
            <a href="#booking">{t.footer.bookLink}</a>
          </div>
          <p className="footer-note" dir={t.dir}>{t.footer.rights}</p>
        </footer>
        <StratixChat />
        <WhatsAppButton />
      </div>
      </AnimatePresence>
    </>
  );
}
