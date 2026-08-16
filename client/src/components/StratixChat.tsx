import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpLeft, MessageSquareText, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getChatbotAnswer, getChatbotQuickQuestions } from "@/lib/chatbot";
import { trpc } from "@/lib/trpc";

type Message = {
  id: number;
  author: "bot" | "user";
  text: string;
};

type HandoffTopic = "new_site" | "existing_issue" | "other";
// null       → not in handoff
// "topic"    → choosing what they need
// a topic    → entering their contact details
// "sent"     → submitted, confirmation shown
type HandoffStage = null | "topic" | HandoffTopic | "sent";

const greeting = {
  ar: "أهلاً بك في STRATIX. اسألني عن الخدمة، السعر، المدة، الحجز، أو التواصل.",
  en: "Welcome to STRATIX. Ask me about the service, pricing, timeline, booking, or how to reach us.",
};

const chatCopy = {
  ar: {
    panelAria: "مساعد STRATIX",
    signalLabel: "STRATIX SIGNAL",
    signalNote: "إجابات فورية ودقيقة",
    close: "إغلاق المحادثة",
    quickQuestionsAria: "أسئلة سريعة",
    questionLabel: "اكتب سؤالك",
    placeholder: "مثال: الأسعار كام؟",
    send: "إرسال السؤال",
    bookingLink: "ابدأ حجز مشروعك",
    launcher: "اسألنا",
    topicAria: "اختر نوع الطلب",
    topics: {
      new_site: "عايز أعمل موقع",
      existing_issue: "مشكلة في موقع قائم",
      other: "استفسار تاني",
    },
    phonePlaceholder: "رقم موبايلك (واتساب)",
    emailPlaceholder: "بريدك الإلكتروني (اختياري)",
    sendRequest: "إرسال الطلب",
    sending: "جارٍ الإرسال…",
    topicPrompt: "تمام! سيب رقمك وهنكلمك في أقرب وقت.",
    sentOk: "تم استلام طلبك ✅ الفريق هيكلمك على الرقم ده في أقرب وقت.",
    sentFail: "حصل خطأ بسيط. جرب تاني أو كلمنا مباشرة على واتساب 01125839109.",
    badPhone: "من فضلك اكتب رقم موبايل صحيح.",
  },
  en: {
    panelAria: "STRATIX Assistant",
    signalLabel: "STRATIX SIGNAL",
    signalNote: "Instant, precise answers",
    close: "Close chat",
    quickQuestionsAria: "Quick questions",
    questionLabel: "Type your question",
    placeholder: "e.g. What are your prices?",
    send: "Send question",
    bookingLink: "Start your project",
    launcher: "Ask us",
    topicAria: "Choose a request type",
    topics: {
      new_site: "I want a website",
      existing_issue: "Issue with an existing site",
      other: "Another question",
    },
    phonePlaceholder: "Your mobile (WhatsApp)",
    emailPlaceholder: "Your email (optional)",
    sendRequest: "Send request",
    sending: "Sending…",
    topicPrompt: "Great — leave your number and we'll reach out shortly.",
    sentOk: "Request received ✅ The team will contact you on this number shortly.",
    sentFail: "Something went wrong. Try again, or message us on WhatsApp 01125839109.",
    badPhone: "Please enter a valid mobile number.",
  },
};

export default function StratixChat() {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: 1, author: "bot", text: greeting[language] }]);
  const [stage, setStage] = useState<HandoffStage>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const sequence = useRef(1);
  const reduceMotion = useReducedMotion();
  const copy = chatCopy[language];

  const contactMutation = trpc.contact.request.useMutation();

  useEffect(() => {
    sequence.current = 1;
    setMessages([{ id: 1, author: "bot", text: greeting[language] }]);
    setStage(null);
    setPhone("");
    setEmail("");
  }, [language]);

  const pushBot = (text: string) => {
    sequence.current += 1;
    setMessages(current => [...current, { id: sequence.current, author: "bot", text }]);
  };

  const ask = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    const answer = getChatbotAnswer(trimmed, language);
    sequence.current += 2;
    setMessages(current => [
      ...current,
      { id: sequence.current - 1, author: "user", text: trimmed },
      { id: sequence.current, author: "bot", text: answer.text },
    ]);

    // A "talk to a person" answer opens the handoff flow instead of ending.
    if (answer.action === "handoff") {
      setStage("topic");
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    ask(String(data.get("question") ?? ""));
    form.reset();
  };

  const chooseTopic = (topic: HandoffTopic) => {
    sequence.current += 1;
    setMessages(current => [...current, { id: sequence.current, author: "user", text: copy.topics[topic] }]);
    setStage(topic);
    pushBot(copy.topicPrompt);
  };

  const submitContact = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (stage !== "new_site" && stage !== "existing_issue" && stage !== "other") return;
    const topic = stage;

    if (phone.trim().length < 6) {
      pushBot(copy.badPhone);
      return;
    }

    // Show the visitor their own submission, then confirm on success.
    sequence.current += 1;
    setMessages(current => [
      ...current,
      { id: sequence.current, author: "user", text: email.trim() ? `${phone.trim()} — ${email.trim()}` : phone.trim() },
    ]);

    contactMutation.mutate(
      { topic, phone: phone.trim(), clientEmail: email.trim() || undefined, website: "" },
      {
        onSuccess: () => {
          setStage("sent");
          pushBot(copy.sentOk);
        },
        onError: () => {
          pushBot(copy.sentFail);
        },
      },
    );
  };

  const inContactForm = stage === "new_site" || stage === "existing_issue" || stage === "other";

  return (
    <div className="stratix-chat" dir={language === "ar" ? "rtl" : "ltr"}>
      <AnimatePresence>
        {open && (
          <motion.section
            id="stratix-chat-panel"
            className="chat-panel"
            role="region"
            aria-label={copy.panelAria}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 22, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.23, 1, 0.32, 1] }}
          >
            <header className="chat-header">
              <div>
                <span className="chat-status-dot" aria-hidden="true" />
                <p><b>{copy.signalLabel}</b><small>{copy.signalNote}</small></p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={copy.close}>
                <X aria-hidden="true" />
              </button>
            </header>

            <div className="chat-messages" aria-live="polite">
              {messages.map(message => (
                <motion.p
                  className="chat-message"
                  data-author={message.author}
                  key={message.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {message.text}
                </motion.p>
              ))}
            </div>

            {/* Handoff: choose a topic */}
            {stage === "topic" && (
              <div className="chat-quick-questions" aria-label={copy.topicAria}>
                {(Object.keys(copy.topics) as HandoffTopic[]).map(topic => (
                  <button type="button" key={topic} onClick={() => chooseTopic(topic)}>
                    {copy.topics[topic]}
                  </button>
                ))}
              </div>
            )}

            {/* Handoff: collect contact */}
            {inContactForm && (
              <form className="chat-contact-form" onSubmit={submitContact}>
                <input
                  type="tel"
                  inputMode="tel"
                  name="phone"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder={copy.phonePlaceholder}
                  autoComplete="tel"
                  maxLength={32}
                  required
                  dir="ltr"
                />
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={copy.emailPlaceholder}
                  autoComplete="email"
                  maxLength={320}
                  dir="ltr"
                />
                {/* Honeypot: hidden from people, tempting to bots. */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
                />
                <button type="submit" disabled={contactMutation.isPending}>
                  {contactMutation.isPending ? copy.sending : copy.sendRequest}
                </button>
              </form>
            )}

            {/* Normal quick questions, hidden during the handoff flow */}
            {stage === null && (
              <div className="chat-quick-questions" aria-label={copy.quickQuestionsAria}>
                {getChatbotQuickQuestions(language).map(question => (
                  <button type="button" key={question.id} onClick={() => ask(question.label)}>
                    {question.label}
                  </button>
                ))}
              </div>
            )}

            <form className="chat-input-row" onSubmit={handleSubmit}>
              <label className="sr-only" htmlFor="chat-question">{copy.questionLabel}</label>
              <input id="chat-question" name="question" placeholder={copy.placeholder} autoComplete="off" maxLength={160} />
              <button type="submit" aria-label={copy.send}><Send aria-hidden="true" /></button>
            </form>

            <a className="chat-booking-link" href="#booking" onClick={() => setOpen(false)}>
              {copy.bookingLink} <ArrowUpLeft aria-hidden="true" />
            </a>
          </motion.section>
        )}
      </AnimatePresence>

      <button
        className="chat-launcher"
        type="button"
        aria-expanded={open}
        aria-controls="stratix-chat-panel"
        onClick={() => setOpen(value => !value)}
      >
        <span>{copy.launcher}</span>
        <MessageSquareText aria-hidden="true" />
      </button>
    </div>
  );
}
