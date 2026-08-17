import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { AlertCircle, ArrowLeft, Building2, Check, Copy, Loader2, Smartphone } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

// Payment happens outside this page: the client transfers by InstaPay or bank
// transfer, then confirms here. Nothing on this page touches a card or a
// gateway — it shows where to send money and records that the client says they
// sent it. An owner confirms the money actually arrived before it counts.

type LookupResult = {
  publicId: string;
  name: string;
  amountDue: string | null;
  currency: string;
  paymentStatus: "unpaid" | "awaiting_review" | "paid";
  methods: { instapay: string; iban: string; bankName: string; accountName: string } | null;
};

const copy = {
  ar: {
    dir: "rtl" as const,
    back: "رجوع للموقع",
    title: "دفع مستحقات مشروعك",
    intro: "اكتب رقم طلبك ورقم الهاتف اللي حجزت بيه، وهنوريك المبلغ وطرق التحويل.",
    orderLabel: "رقم الطلب",
    orderPlaceholder: "STRX-XXXXXXXXXX",
    phoneLabel: "رقم الهاتف",
    phonePlaceholder: "01xxxxxxxxx",
    continue: "متابعة",
    checking: "جارٍ التحقق…",
    hello: (name: string) => `أهلاً ${name}`,
    order: "الطلب",
    amountDue: "المبلغ المستحق",
    noAmountTitle: "لسه ما اتحددش مبلغ لطلبك",
    noAmountText:
      "بنراجع تفاصيل المشروع الأول وبعدين بنحدد السعر. تواصل معنا وهنجهزلك عرض السعر.",
    alreadyPaidTitle: "الطلب ده مدفوع بالفعل ✅",
    alreadyPaidText: "شكراً لك. لو عندك أي استفسار تواصل معنا.",
    reviewTitle: "استلمنا تأكيدك ✅",
    reviewText: "بنراجع وصول المبلغ دلوقتي، وهنتواصل معك للتأكيد.",
    methodsTitle: "حوّل المبلغ بأي طريقة من دول",
    instapay: "InstaPay",
    bank: "تحويل بنكي",
    accountName: "اسم الحساب",
    bankName: "البنك",
    iban: "رقم الحساب (IBAN)",
    copy: "نسخ",
    copied: "تم النسخ",
    afterTitle: "بعد ما تحوّل",
    afterText: "اكتب رقم عملية التحويل عشان نراجعها ونأكدلك.",
    refLabel: "رقم عملية التحويل",
    refPlaceholder: "مثال: TX-83920184",
    confirm: "أكدت التحويل",
    sending: "جارٍ الإرسال…",
    doneTitle: "تم استلام تأكيدك ✅",
    doneText:
      "هنراجع وصول المبلغ ونتواصل معك في أقرب وقت. احتفظ برقم عملية التحويل لحد التأكيد.",
    note: "ملاحظة: التأكيد ده بيوصلنا فوراً، لكن الطلب بيتعلّم كمدفوع بعد ما نتأكد إن المبلغ وصل فعلاً.",
    tryAgain: "تعديل البيانات",
  },
  en: {
    dir: "ltr" as const,
    back: "Back to site",
    title: "Pay for your project",
    intro: "Enter your order number and the phone you booked with, and we'll show the amount and how to transfer.",
    orderLabel: "Order number",
    orderPlaceholder: "STRX-XXXXXXXXXX",
    phoneLabel: "Phone number",
    phonePlaceholder: "01xxxxxxxxx",
    continue: "Continue",
    checking: "Checking…",
    hello: (name: string) => `Hello ${name}`,
    order: "Order",
    amountDue: "Amount due",
    noAmountTitle: "Your quote isn't ready yet",
    noAmountText: "We review the project details first, then set the price. Get in touch and we'll prepare your quote.",
    alreadyPaidTitle: "This order is already paid ✅",
    alreadyPaidText: "Thank you. Reach out any time if you have questions.",
    reviewTitle: "We received your confirmation ✅",
    reviewText: "We're checking that the transfer arrived and will confirm with you.",
    methodsTitle: "Transfer using either of these",
    instapay: "InstaPay",
    bank: "Bank transfer",
    accountName: "Account name",
    bankName: "Bank",
    iban: "Account number (IBAN)",
    copy: "Copy",
    copied: "Copied",
    afterTitle: "After you transfer",
    afterText: "Enter the transfer reference so we can match and confirm it.",
    refLabel: "Transfer reference",
    refPlaceholder: "e.g. TX-83920184",
    confirm: "I've transferred",
    sending: "Sending…",
    doneTitle: "Confirmation received ✅",
    doneText: "We'll verify the transfer and get back to you shortly. Keep the reference until then.",
    note: "Note: this reaches us immediately, but the order is marked paid only after we confirm the money arrived.",
    tryAgain: "Edit details",
  },
};

function CopyRow({ label, value, copyText, copiedText }: { label: string; value: string; copyText: string; copiedText: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="pay-row">
      <span className="pay-row-label">{label}</span>
      <span className="pay-row-value" dir="ltr">{value}</span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            },
            () => {},
          );
        }}
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? copiedText : copyText}
      </button>
    </div>
  );
}

export default function Pay() {
  const { language } = useLanguage();
  const t = copy[language];

  const [publicId, setPublicId] = useState("");
  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState("");
  const [found, setFound] = useState<LookupResult | null>(null);
  const [declared, setDeclared] = useState(false);
  const [error, setError] = useState("");

  const lookup = trpc.payment.lookup.useMutation({
    onSuccess: data => {
      setFound(data as LookupResult);
      setError("");
    },
    onError: e => {
      setFound(null);
      setError(e.message);
    },
  });

  const declare = trpc.payment.declare.useMutation({
    onSuccess: () => {
      setDeclared(true);
      setError("");
    },
    onError: e => setError(e.message),
  });

  const reset = () => {
    setFound(null);
    setDeclared(false);
    setError("");
    setReference("");
  };

  return (
    <main className="pay-page" dir={t.dir}>
      <div className="pay-card">
        <Link className="pay-back" href="/">
          <ArrowLeft aria-hidden="true" /> {t.back}
        </Link>

        <h1>{t.title}</h1>

        {/* Step 1 — identify the order */}
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
                  placeholder={t.orderPlaceholder}
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
                  t.continue
                )}
              </button>
            </form>
          </>
        )}

        {error && !found && (
          <p className="pay-error" role="alert">
            <AlertCircle aria-hidden="true" /> {error}
          </p>
        )}

        {/* Step 2 — the order, the amount, and where to send it */}
        {found && !declared && (
          <div className="pay-result">
            <p className="pay-hello">{t.hello(found.name)}</p>
            <div className="pay-order">
              <span>{t.order}</span>
              <strong dir="ltr">{found.publicId}</strong>
            </div>

            {found.paymentStatus === "paid" ? (
              <div className="pay-state pay-state-ok">
                <h2>{t.alreadyPaidTitle}</h2>
                <p>{t.alreadyPaidText}</p>
              </div>
            ) : !found.amountDue ? (
              <div className="pay-state">
                <h2>{t.noAmountTitle}</h2>
                <p>{t.noAmountText}</p>
              </div>
            ) : found.paymentStatus === "awaiting_review" ? (
              <div className="pay-state pay-state-ok">
                <h2>{t.reviewTitle}</h2>
                <p>{t.reviewText}</p>
              </div>
            ) : (
              <>
                <div className="pay-amount">
                  <span>{t.amountDue}</span>
                  <strong dir="ltr">
                    {found.amountDue} {found.currency}
                  </strong>
                </div>

                <h2 className="pay-section-title">{t.methodsTitle}</h2>

                {found.methods?.instapay && (
                  <div className="pay-method">
                    <div className="pay-method-head">
                      <Smartphone aria-hidden="true" /> {t.instapay}
                    </div>
                    <CopyRow label={t.instapay} value={found.methods.instapay} copyText={t.copy} copiedText={t.copied} />
                  </div>
                )}

                {found.methods?.iban && (
                  <div className="pay-method">
                    <div className="pay-method-head">
                      <Building2 aria-hidden="true" /> {t.bank}
                    </div>
                    {found.methods.accountName && (
                      <CopyRow label={t.accountName} value={found.methods.accountName} copyText={t.copy} copiedText={t.copied} />
                    )}
                    {found.methods.bankName && (
                      <CopyRow label={t.bankName} value={found.methods.bankName} copyText={t.copy} copiedText={t.copied} />
                    )}
                    <CopyRow label={t.iban} value={found.methods.iban} copyText={t.copy} copiedText={t.copied} />
                  </div>
                )}

                <h2 className="pay-section-title">{t.afterTitle}</h2>
                <p className="pay-intro">{t.afterText}</p>
                <form
                  className="pay-form"
                  onSubmit={event => {
                    event.preventDefault();
                    declare.mutate({
                      publicId: found.publicId,
                      phone: phone.trim(),
                      reference: reference.trim(),
                    });
                  }}
                >
                  <label>
                    <span>{t.refLabel}</span>
                    <input
                      value={reference}
                      onChange={e => setReference(e.target.value)}
                      placeholder={t.refPlaceholder}
                      dir="ltr"
                      maxLength={120}
                      required
                    />
                  </label>
                  <button type="submit" disabled={declare.isPending}>
                    {declare.isPending ? (
                      <>
                        <Loader2 className="pay-spin" aria-hidden="true" /> {t.sending}
                      </>
                    ) : (
                      t.confirm
                    )}
                  </button>
                </form>
                <p className="pay-note">{t.note}</p>
              </>
            )}

            {error && (
              <p className="pay-error" role="alert">
                <AlertCircle aria-hidden="true" /> {error}
              </p>
            )}

            <button type="button" className="pay-reset" onClick={reset}>
              {t.tryAgain}
            </button>
          </div>
        )}

        {/* Step 3 — confirmation recorded */}
        {declared && (
          <div className="pay-state pay-state-ok">
            <h2>{t.doneTitle}</h2>
            <p>{t.doneText}</p>
            <Link className="pay-back" href="/">
              <ArrowLeft aria-hidden="true" /> {t.back}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
