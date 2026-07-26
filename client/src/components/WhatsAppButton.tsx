import { useLanguage } from "@/contexts/LanguageContext";

const WHATSAPP_NUMBER = "201125839109";

const copy = {
  ar: {
    label: "تواصل عبر واتساب",
    message: "أهلاً STRATIX، عايز أعرف تفاصيل عن خدمة تصميم المواقع.",
  },
  en: {
    label: "Chat on WhatsApp",
    message: "Hello STRATIX, I'd like to know more about your website design service.",
  },
};

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 32 32" width="1.3rem" height="1.3rem" fill="currentColor" aria-hidden="true">
      <path d="M16.02 3C9.4 3 4 8.37 4 14.98c0 2.3.63 4.45 1.72 6.3L3 29l7.9-2.66a12.9 12.9 0 0 0 5.12 1.05h.01c6.62 0 12.02-5.37 12.02-11.98C28.05 8.4 22.65 3 16.02 3Zm0 21.9h-.01a9.9 9.9 0 0 1-5.05-1.39l-.36-.21-4.69 1.58 1.57-4.6-.24-.38a9.87 9.87 0 0 1-1.53-5.32C5.71 9.4 10.35 4.9 16.02 4.9c2.65 0 5.14 1.03 7.01 2.9a9.84 9.84 0 0 1 2.9 6.99c0 5.5-4.64 9.99-9.91 9.99Zm5.44-7.42c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.09 3.2 5.07 4.48.71.31 1.26.49 1.69.63.71.22 1.35.19 1.86.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  );
}

export default function WhatsAppButton() {
  const { language } = useLanguage();
  const { label, message } = copy[language];

  return (
    <div className="whatsapp-widget">
      <a
        className="whatsapp-launcher"
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noreferrer"
        aria-label={label}
      >
        <WhatsAppIcon />
      </a>
    </div>
  );
}
