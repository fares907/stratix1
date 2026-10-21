import { lazy, Suspense, useEffect, useRef } from "react";
import type { FormEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import SplashScreen from "@/components/SplashScreen";
import StratixChat from "@/components/StratixChat";
import WhatsAppButton from "@/components/WhatsAppButton";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLitePerformance, useOnScreen } from "@/hooks/useLitePerformance";
import { trpc } from "@/lib/trpc";
import { m, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import {
  ArrowUpLeft,
  Boxes,
  CalendarDays,
  Code2,
  Gauge,
  Languages,
  Layers3,
  Lock,
  Mail,
  MessageCircle,
  MonitorSmartphone,
  Phone,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

// The country picker carries the full phone-number rules (hundreds of KB), so it
// loads after the page is interactive instead of delaying first paint. Until it
// arrives a plain phone input stands in, so the form always works.
const loadPhoneField = () => import("@/components/PhoneField");
const PhoneField = lazy(loadPhoneField);

const EASE = [0.16, 1, 0.3, 1] as const;

function Reveal({
  children,
  className = "",
  delay = 0,
  dir,
  as = "div",
  spotlight = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  dir?: "rtl" | "ltr";
  as?: "div" | "li" | "article";
  spotlight?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const Component = as === "li" ? m.li : as === "article" ? m.article : m.div;
  return (
    <Component
      className={className}
      dir={dir}
      data-spotlight={spotlight ? "" : undefined}
      initial={reduceMotion ? false : { opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: reduceMotion ? 0 : 0.8, delay: reduceMotion ? 0 : delay, ease: EASE }}
    >
      {children}
    </Component>
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

// Cards light up under the pointer. The position is written to CSS custom
// properties, so the glow is drawn by the compositor with no React re-render.
function trackSpotlight(event: ReactPointerEvent<HTMLElement>) {
  const card = (event.target as HTMLElement).closest<HTMLElement>("[data-spotlight]");
  if (!card) return;
  const rect = card.getBoundingClientRect();
  card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
  card.style.setProperty("--my", `${event.clientY - rect.top}px`);
}

export default function Home() {
  const reduceMotion = useReducedMotion();
  const lite = useLitePerformance();
  const { t, toggleLanguage, language } = useLanguage();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });
  const heroDrift = useTransform(scrollYProgress, [0, 0.25], [0, -90]);
  const orbitDrift = useTransform(scrollYProgress, [0, 0.3], [0, 140]);

  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    idle(() => void loadPhoneField());
  }, []);

  const bookingRequestKey = useRef(crypto.randomUUID());
  const bookingMutation = trpc.booking.submit.useMutation();

  // Looping motion (orbits, aurora, marquee) only runs while on screen and never
  // on low-power devices or for visitors who asked for reduced motion.
  const heroRef = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const heroOnScreen = useOnScreen(heroRef);
  const stripOnScreen = useOnScreen(stripRef);
  const allowMotion = !reduceMotion && !lite;

  const timelineRef = useRef<HTMLOListElement>(null);
  const { scrollYProgress: timelineProgress } = useScroll({
    target: timelineRef,
    offset: ["start 80%", "end 60%"],
  });

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

  const capabilityIcons = [Code2, Gauge, Sparkles, ShieldCheck];

  return (
    <>
      <SplashScreen />
      <div className="site-shell" data-motion={allowMotion ? "on" : "off"}>
        <m.div className="scroll-progress" style={{ scaleX: progress }} aria-hidden="true" />

        <header className="site-header" aria-label={t.nav.headerAria}>
          <div className="nav-pill">
            <a className="logo-lockup" href="#top" aria-label={t.nav.logoAria}>
              <BrandMark />
              <span className="logo-word" dir="ltr">
                STRATIX
              </span>
            </a>

            <nav className="main-nav" aria-label={t.nav.navAria}>
              <a href="#services">{t.nav.services}</a>
              <a href="#process">{t.nav.process}</a>
              <a href="#founders">{t.nav.founders}</a>
            </nav>

            <div className="nav-actions">
              <button type="button" className="lang-toggle" onClick={toggleLanguage} aria-label={t.nav.langToggleAria}>
                <Languages aria-hidden="true" />
                <span>{t.nav.langToggle}</span>
              </button>
              <a className="nav-cta" href="#booking">
                <span>{t.nav.cta}</span>
                <ArrowUpLeft aria-hidden="true" />
              </a>
            </div>
          </div>
        </header>

        <main>
          {/* ── Hero ─────────────────────────────────────────────── */}
          <section
            id="top"
            ref={heroRef}
            className="hero"
            data-live={allowMotion && heroOnScreen ? "on" : "off"}
            aria-labelledby="hero-title"
          >
            <div className="aurora" aria-hidden="true">
              <span className="aurora-blob aurora-a" />
              <span className="aurora-blob aurora-b" />
              <span className="aurora-blob aurora-c" />
            </div>
            <div className="hero-grid" aria-hidden="true" />

            <m.div className="orbit" style={{ y: reduceMotion ? 0 : orbitDrift }} aria-hidden="true">
              <span className="orbit-ring orbit-ring-1">
                <i />
              </span>
              <span className="orbit-ring orbit-ring-2">
                <i />
              </span>
              <span className="orbit-ring orbit-ring-3">
                <i />
              </span>
              <span className="orbit-core">S</span>
            </m.div>

            <span className="float-shape float-cube" aria-hidden="true" />
            <span className="float-shape float-ring" aria-hidden="true" />
            <span className="float-shape float-dot" aria-hidden="true" />

            <m.div
              className="hero-inner"
              style={{ y: reduceMotion ? 0 : heroDrift }}
              dir={t.dir}
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } } }}
            >
              <m.p
                className="hero-chip"
                variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } }}
              >
                <span className="pulse-dot" />
                {t.hero.signal}
                <span className="hero-chip-sep" />
                <span dir="ltr">{t.hero.eyebrow}</span>
              </m.p>

              <h1 id="hero-title" className="hero-title">
                <m.span
                  className="hero-line"
                  variants={{
                    hidden: { opacity: 0, y: "60%" },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
                  }}
                >
                  {t.hero.statementTitle1}
                </m.span>
                <m.span
                  className="hero-line hero-line-gradient"
                  variants={{
                    hidden: { opacity: 0, y: "60%" },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
                  }}
                >
                  {t.hero.statementTitle2}
                </m.span>
              </h1>

              <m.p
                className="hero-summary"
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.7 } } }}
              >
                {t.hero.summary}
              </m.p>

              <m.div
                className="hero-actions"
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.7 } } }}
              >
                <a className="btn btn-primary" href="#booking">
                  <span>{t.hero.bookCta}</span>
                  <ArrowUpLeft aria-hidden="true" />
                </a>
                <a className="btn btn-ghost" href="#services">
                  {t.hero.discoverCta}
                </a>
              </m.div>

              <m.dl
                className="hero-stats"
                aria-label={t.hero.metaAria}
                variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.8 } } }}
              >
                {t.hero.stats.map(stat => (
                  <div key={stat.label}>
                    <dt>{stat.label}</dt>
                    <dd dir="ltr">{stat.value}</dd>
                  </div>
                ))}
              </m.dl>
            </m.div>

            <m.div
              className="hero-device"
              aria-hidden="true"
              initial={reduceMotion ? false : { opacity: 0, y: 60, rotateX: 18 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 1.2, delay: 0.55, ease: EASE }}
            >
              <div className="device-frame">
                <div className="device-bar">
                  <i />
                  <i />
                  <i />
                  <span dir="ltr">stratix.website</span>
                </div>
                <div className="device-screen">
                  <div className="mock-nav">
                    <b />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="mock-hero">
                    <b />
                    <b className="mock-short" />
                    <span className="mock-cta" />
                  </div>
                  <div className="mock-cards">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
              <span className="device-badge badge-speed">
                <Zap /> {t.hero.badgeSpeed}
              </span>
              <span className="device-badge badge-secure">
                <Lock /> {t.hero.badgeSecurity}
              </span>
              <span className="device-badge badge-responsive">
                <MonitorSmartphone /> {t.hero.badgeResponsive}
              </span>
            </m.div>
          </section>

          {/* ── Marquee ─────────────────────────────────────────── */}
          <div
            className="marquee"
            ref={stripRef}
            data-live={allowMotion && stripOnScreen ? "on" : "off"}
            aria-hidden="true"
            dir="ltr"
          >
            <div className="marquee-track">
              {[0, 1].map(copy => (
                <div className="marquee-group" key={copy}>
                  {["SPEED", "MOTION", "TRUST", "SCALE", "SECURITY", "CRAFT"].map(word => (
                    <span key={word}>
                      {word}
                      <i />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* ── Manifesto ───────────────────────────────────────── */}
          <section id="manifesto" className="section manifesto" dir={t.dir}>
            <Reveal className="section-tag">{t.manifesto.index}</Reveal>
            <Reveal className="manifesto-quote">
              <p>
                {t.manifesto.quote1}
                <span className="text-gradient">{t.manifesto.quoteHighlight}</span>
                <br />
                {t.manifesto.quote2}
              </p>
            </Reveal>
            <Reveal className="manifesto-note" delay={0.1}>
              <Sparkles aria-hidden="true" />
              <p>{t.manifesto.note}</p>
            </Reveal>
          </section>

          {/* ── Services (bento) ────────────────────────────────── */}
          <section id="services" className="section services" dir={t.dir} aria-labelledby="service-title">
            <div className="section-head">
              <Reveal className="section-tag">{t.services.index}</Reveal>
              <Reveal>
                <p className="eyebrow" dir="ltr">
                  {t.services.eyebrow}
                </p>
                <h2 id="service-title" className="section-title">
                  {t.services.title1} <span className="text-gradient">{t.services.title2}</span>
                </h2>
              </Reveal>
            </div>

            <div className="bento" onPointerMove={trackSpotlight}>
              <Reveal as="article" className="bento-card bento-price" spotlight>
                <span className="bento-label">{t.services.priceLabel}</span>
                <p className="bento-price-title">{t.services.priceHeadline}</p>
                <p className="bento-price-sub">{t.services.priceCurrency}</p>
                <p className="bento-text">{t.services.priceNote}</p>
                <a className="btn btn-primary btn-sm" href="#booking">
                  <span>{t.nav.cta}</span>
                  <ArrowUpLeft aria-hidden="true" />
                </a>
              </Reveal>

              <Reveal as="article" className="bento-card bento-scope" delay={0.05} spotlight>
                <Boxes className="bento-icon" aria-hidden="true" />
                <h3>{t.services.scopeTitle}</h3>
                <p className="bento-text">{t.services.scopeText}</p>
                <ul className="bento-tags">
                  {t.services.scopeTags.map(tag => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              </Reveal>

              {t.services.capabilities.map((capability, position) => {
                const Icon = capabilityIcons[position] ?? Layers3;
                return (
                  <Reveal
                    as="article"
                    className="bento-card"
                    delay={0.08 + position * 0.05}
                    key={capability.title}
                    spotlight
                  >
                    <Icon className="bento-icon" aria-hidden="true" />
                    <h3>{capability.title}</h3>
                    <p className="bento-text">{capability.text}</p>
                    <span className="bento-index" dir="ltr">{`0${position + 1}`}</span>
                  </Reveal>
                );
              })}
            </div>
          </section>

          {/* ── Process (timeline) ──────────────────────────────── */}
          <section id="process" className="section process" dir={t.dir} aria-labelledby="process-title">
            <div className="section-head">
              <Reveal className="section-tag">{t.process.index}</Reveal>
              <Reveal>
                <p className="eyebrow" dir="ltr">
                  {t.process.eyebrow}
                </p>
                <h2 id="process-title" className="section-title">
                  {t.process.title1} <span className="text-gradient">{t.process.title2}</span>
                </h2>
                <p className="section-lead">{t.process.intro}</p>
              </Reveal>
            </div>

            <ol className="timeline" ref={timelineRef}>
              <m.span
                className="timeline-fill"
                style={{ scaleY: reduceMotion ? 1 : timelineProgress }}
                aria-hidden="true"
              />
              {t.process.steps.map((step, position) => (
                <Reveal as="li" className="timeline-step" delay={position * 0.08} key={step.title}>
                  <span className="timeline-node" dir="ltr">
                    {String(position + 1).padStart(2, "0")}
                  </span>
                  <div className="timeline-card">
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </section>

          {/* ── About ───────────────────────────────────────────── */}
          <section id="founders" className="section about" dir={t.dir} aria-labelledby="founders-title">
            <div className="about-glow" aria-hidden="true" />
            <div className="section-head">
              <Reveal className="section-tag">{t.founders.index}</Reveal>
              <Reveal>
                <p className="eyebrow" dir="ltr">
                  {t.founders.eyebrow}
                </p>
                <h2 id="founders-title" className="section-title">
                  {t.founders.title}
                </h2>
              </Reveal>
            </div>
            <div className="about-grid">
              <Reveal className="about-story">
                <p>{t.founders.story}</p>
              </Reveal>
              <ul className="founder-list">
                {t.founders.list.map((founder, position) => (
                  <Reveal as="li" className="founder-card" delay={position * 0.1} key={founder.name}>
                    <span className="founder-avatar" dir="ltr">
                      {String(position + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3>{founder.name}</h3>
                      <p>{founder.role}</p>
                    </div>
                    <BrandMark />
                  </Reveal>
                ))}
              </ul>
            </div>
          </section>

          {/* ── Booking ─────────────────────────────────────────── */}
          <section id="booking" className="section booking" dir={t.dir} aria-labelledby="booking-title">
            <div className="booking-grid">
              <Reveal className="booking-intro">
                <span className="section-tag">{t.booking.index}</span>
                <p className="eyebrow" dir="ltr">
                  {t.booking.eyebrow}
                </p>
                <h2 id="booking-title" className="section-title">
                  {t.booking.title1} <span className="text-gradient">{t.booking.title2}</span>
                </h2>
                <p className="section-lead">{t.booking.intro}</p>

                <div className="contact-list">
                  <a href="tel:+201125839109" dir="ltr">
                    <Phone aria-hidden="true" /> 011 2583 9109
                  </a>
                  <a href="tel:+201036678093" dir="ltr">
                    <Phone aria-hidden="true" /> 010 3667 8093
                  </a>
                  <a href="mailto:stratix255@gmail.com" dir="ltr">
                    <Mail aria-hidden="true" /> stratix255@gmail.com
                  </a>
                  <a href="https://wa.me/201125839109" target="_blank" rel="noreferrer">
                    <MessageCircle aria-hidden="true" /> {t.booking.whatsappLabel}
                  </a>
                </div>
              </Reveal>

              <Reveal className="booking-panel" delay={0.1}>
                <div className="booking-panel-top">
                  <div>
                    <CalendarDays aria-hidden="true" />
                    <span>{t.booking.panelTitle}</span>
                  </div>
                  <span className="secure-label">
                    <i /> {t.booking.secureLabel}
                  </span>
                </div>

                <form className="booking-form" onSubmit={handleBookingSubmit} aria-busy={bookingMutation.isPending}>
                  <label className="booking-website-field" aria-hidden="true">
                    <span>{t.booking.websiteLabel}</span>
                    <input name="website" type="text" tabIndex={-1} autoComplete="off" />
                  </label>
                  <label>
                    <span>{t.booking.nameLabel}</span>
                    <input
                      name="name"
                      type="text"
                      placeholder={t.booking.namePlaceholder}
                      autoComplete="name"
                      minLength={2}
                      maxLength={80}
                      required
                    />
                  </label>
                  <label>
                    <span>{t.booking.phoneLabel}</span>
                    <Suspense
                      fallback={
                        <input
                          name="phone"
                          type="tel"
                          dir="ltr"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="+20 100 000 0000"
                          required
                        />
                      }
                    >
                      <PhoneField />
                    </Suspense>
                  </label>
                  <label className="form-span-2">
                    <span>
                      {t.booking.emailLabel} <small>{t.booking.optional}</small>
                    </span>
                    <input
                      name="clientEmail"
                      type="email"
                      placeholder={t.booking.emailPlaceholder}
                      autoComplete="email"
                      inputMode="email"
                      dir="ltr"
                      maxLength={320}
                    />
                  </label>
                  <label>
                    <span>{t.booking.typeLabel}</span>
                    <select name="projectType" defaultValue="" required>
                      <option value="" disabled>
                        {t.booking.typeSelect}
                      </option>
                      <option value="company">{t.booking.typeCompany}</option>
                      <option value="personal">{t.booking.typePersonal}</option>
                      <option value="other">{t.booking.typeOther}</option>
                    </select>
                  </label>
                  <label>
                    <span>{t.booking.budgetLabel}</span>
                    {/* Values are legacy price bands kept so stored bookings stay
                        valid; the labels now describe project size, same order. */}
                    <select name="budget" defaultValue="" required>
                      <option value="" disabled>
                        {t.booking.budgetSelect}
                      </option>
                      <option value="700-1500">{t.booking.budget1}</option>
                      <option value="1500-3000">{t.booking.budget2}</option>
                      <option value="3000+">{t.booking.budget3}</option>
                    </select>
                  </label>
                  <label className="form-span-2">
                    <span>
                      {t.booking.detailsLabel} <small>{t.booking.optional}</small>
                    </span>
                    <textarea
                      name="details"
                      placeholder={t.booking.detailsPlaceholder}
                      rows={4}
                      minLength={15}
                      maxLength={2000}
                    />
                  </label>
                  <button className="btn btn-primary submit-button form-span-2" type="submit" disabled={bookingMutation.isPending}>
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
            </div>
          </section>
        </main>

        <footer className="site-footer" dir={t.dir}>
          <div className="footer-top">
            <p className="footer-tagline">{t.footer.tagline}</p>
            <div className="footer-links">
              <a href="#top">{t.footer.topLink}</a>
              <a href="#booking">{t.footer.bookLink}</a>
              <a href="/track">{t.footer.trackLink}</a>
            </div>
          </div>
          <div className="footer-word" dir="ltr" aria-hidden="true">
            STRATIX
          </div>
          <p className="footer-note">{t.footer.rights}</p>
        </footer>

        <StratixChat />
        <WhatsAppButton />
      </div>
    </>
  );
}
