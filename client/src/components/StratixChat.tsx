import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpLeft, MessageSquareText, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getChatbotAnswer, getChatbotQuickQuestions } from "@/lib/chatbot";

type Message = {
  id: number;
  author: "bot" | "user";
  text: string;
};

const greeting = {
  ar: "أهلاً بك في STRATIX. اسألني عن الخدمة، السعر، المدة، الحجز، أو التواصل.",
  en: "Welcome to STRATIX. Ask me about the service, pricing, timeline, booking, or how to reach us.",
};

const chatCopy = {
  ar: {
    panelAria: "مساعد STRATIX",
    signalLabel: "STRATIX SIGNAL",
    signalNote: "إجابات محددة — بدون ذكاء اصطناعي",
    close: "إغلاق المحادثة",
    quickQuestionsAria: "أسئلة سريعة",
    questionLabel: "اكتب سؤالك",
    placeholder: "مثال: الأسعار كام؟",
    send: "إرسال السؤال",
    bookingLink: "ابدأ حجز مشروعك",
    launcher: "اسألنا",
  },
  en: {
    panelAria: "STRATIX Assistant",
    signalLabel: "STRATIX SIGNAL",
    signalNote: "Fixed answers — no AI",
    close: "Close chat",
    quickQuestionsAria: "Quick questions",
    questionLabel: "Type your question",
    placeholder: "e.g. What are your prices?",
    send: "Send question",
    bookingLink: "Start your project",
    launcher: "Ask us",
  },
};

export default function StratixChat() {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: 1, author: "bot", text: greeting[language] }]);
  const sequence = useRef(1);
  const reduceMotion = useReducedMotion();
  const copy = chatCopy[language];

  useEffect(() => {
    sequence.current = 1;
    setMessages([{ id: 1, author: "bot", text: greeting[language] }]);
  }, [language]);

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
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    ask(String(data.get("question") ?? ""));
    form.reset();
  };

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

            <div className="chat-quick-questions" aria-label={copy.quickQuestionsAria}>
              {getChatbotQuickQuestions(language).map(question => (
                <button type="button" key={question.id} onClick={() => ask(question.label)}>
                  {question.label}
                </button>
              ))}
            </div>

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
