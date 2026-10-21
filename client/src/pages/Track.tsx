import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { AlertCircle, ArrowLeft, Check, CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

// Where a client follows their project. They identify the order the same way
// as on the payment page — order number and the phone they booked with — and
// see the stage an owner last set, plus whether payment is still open.

type Stage = "received" | "design" | "development" | "review" | "delivered";
const STAGES: Stage[] = ["received", "design", "development", "review", "delivered"];

type Result = {
  publicId: string;
  name: string;
  stage: Stage;
  stageUpdatedAt: number | null;
  createdAt: number;
  paymentStatus: "unpaid" | "awaiting_review" | "paid";
  amountDue: string | null;
  currency: string;
};

const copy = {
  ar: {
    dir: "rtl" as const,
    back: "رجوع للموقع",
    title: "تابع طلبك",
    intro: "اكتب رقم الطلب ورقم الهاتف اللي حجزت بيه، وهتشوف مشروعك وصل لفين.",
    orderLabel: "رقم الطلب",
    phoneLabel: "رقم الهاتف",
    phonePlaceholder: "01xxxxxxxxx",
    submit: "اعرض حالة الطلب",
    checking: "جارٍ البحث…",
    hello: (name: string) => `أهلاً ${name}`,
    order: "الطلب",
    since: "اتسجل",
    updated: "آخر تحديث",
    stages: {
      received: { title: "تم الاستلام", text: "طلبك وصلنا وبنراجع التفاصيل." },
      design: { title: "التصميم", text: "بنصمم شكل الموقع وتجربة الاستخدام." },
      development: { title: "البرمجة", text: "بنحوّل التصميم لموقع حقيقي سريع وآمن." },
      review: { title: "المراجعة", text: "بنراجع الأداء والأمان وكل التفاصيل قبل التسليم." },
      delivered: { title: "التسليم", text: "موقعك جاهز ومُسلَّم. مبروك!" },
    } as Record<Stage, { title: string; text: string }>,
    payOpen: "عليك مبلغ مستحق",
    payReview: "بنراجع تحويلك",
    payDone: "المبلغ مدفوع",
    payCta: "ادفع الآن",
    other: "طلب تاني",
  },
  en: {
    dir: "ltr" as const,
    back: "Back to site",
    title: "Track your order",
    intro: "Enter your order number and the phone you booked with to see where your project is.",
    orderLabel: "Order number",
    phoneLabel: "Phone number",
    phonePlaceholder: "01xxxxxxxxx",
    submit: "Show order status",
    checking: "Looking it up…",
    hello: (name: string) => `Hello ${name}`,
    order: "Order",
    since: "Placed",
    updated: "Last update",
    stages: {
      received: { title: "Received", text: "We have your request and are reviewing the details." },
      design: { title: "Design", text: "We're designing the look and the experience." },
      development: { title: "Development", text: "We're turning the design into a fast, secure site." },
      review: { title: "Review", text: "Checking performance, security and every detail before handover." },
      delivered: { title: "Delivered", text: "Your site is ready and handed over. Congratulations!" },
    } as Record<Stage, { title: string; text: string }>,
    payOpen: "Payment due",
    payReview: "Checking your transfer",
    payDone: "Paid",
    payCta: "Pay now",
    other: "Another order",
  },
};

function initialOrderId() {
  try {
    return new URLSearchParams(window.location.search).get("id")?.toUpperCase().slice(0, 32) ?? "";
  } catch {
    return "";
  }
}

export default function Track() {
  const { language } = useLanguage();
  const t = copy[language];

  const [publicId, setPublicId] = useState(initialOrderId);
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<Result | null>(null);
  const [error, setError] = useState("");

  const lookup = trpc.tracking.lookup.useMutation({
    onSuccess: data => {
      setFound(data as Result);
      setError("");
    },
    onError: e => {
      setFound(null);
      setError(e.message);
    },
  });

  const date = (ms: number) =>
    new Date(ms).toLocaleDateString(language === "ar" ? "ar-EG" : "en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const current = found ? STAGES.indexOf(found.stage) : -1;

  return (
    <main className="pay-page" dir={t.dir}>
      <div className="pay-card track-card">
        <Link className="pay-back" href={language === "en" ? "/en" : "/"}>
          <ArrowLeft aria-hidden="true" /> {t.back}
        </Link>

        <h1>{t.title}</h1>

        {!found && (
          <>
            <p className="pay-intro">{t.intro}</p>
            <form
              className="pay-form"
              onSubmit={event => {
                event.preventDefault();
                lookup.mutate({ publicId: publicId.trim(), phone: phone.trim() });
              }}
            >
              <label>
                <span>{t.orderLabel}</span>
                <input
                  value={publicId}
                  onChange={e => setPublicId(e.target.value)}
                  placeholder="STRX-XXXXXXXXXX"
                  dir="ltr"
                  maxLength={32}
                  required
                />
              </label>
              <label>
                <span>{t.phoneLabel}</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder={t.phonePlaceholder}
                  dir="ltr"
                  maxLength={32}
                  autoComplete="tel"
                  required
                />
              </label>
              <button type="submit" disabled={lookup.isPending}>
                {lookup.isPending ? (
                  <>
                    <Loader2 className="pay-spin" aria-hidden="true" /> {t.checking}
                  </>
                ) : (
                  t.submit
                )}
              </button>
            </form>
            {error && (
              <p className="pay-error" role="alert">
                <AlertCircle aria-hidden="true" /> {error}
              </p>
            )}
          </>
        )}

        {found && (
          <div className="pay-result">
            <p className="pay-hello">{t.hello(found.name)}</p>
            <div className="pay-order">
              <span>{t.order}</span>
              <strong dir="ltr">{found.publicId}</strong>
            </div>
            <p className="track-meta">
              {t.since}: {date(found.createdAt)}
              {found.stageUpdatedAt ? ` · ${t.updated}: ${date(found.stageUpdatedAt)}` : ""}
            </p>

            <ol className="track-steps" aria-label={t.title}>
              {STAGES.map((stage, index) => {
                const state = index < current ? "done" : index === current ? "current" : "upcoming";
                return (
                  <li key={stage} className="track-step" data-state={state} aria-current={state === "current" ? "step" : undefined}>
                    <span className="track-dot">{state === "done" ? <Check aria-hidden="true" /> : index + 1}</span>
                    <div>
                      <strong>{t.stages[stage].title}</strong>
                      <p>{t.stages[stage].text}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {found.amountDue && (
              <div className="track-payment" data-state={found.paymentStatus}>
                <CreditCard aria-hidden="true" />
                <span>
                  {found.paymentStatus === "paid"
                    ? t.payDone
                    : found.paymentStatus === "awaiting_review"
                      ? t.payReview
                      : t.payOpen}
                  {found.paymentStatus === "unpaid" && (
                    <strong dir="ltr">
                      {" "}
                      {found.amountDue} {found.currency}
                    </strong>
                  )}
                </span>
                {found.paymentStatus === "unpaid" && (
                  <Link className="track-pay" href="/pay">
                    {t.payCta}
                  </Link>
                )}
              </div>
            )}

            <button
              type="button"
              className="pay-reset"
              onClick={() => {
                setFound(null);
                setError("");
              }}
            >
              {t.other}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
