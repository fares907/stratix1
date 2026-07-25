import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const SESSION_KEY = "stratix-splash-seen";
const AUTO_DISMISS_MS = 2200;

function hasSeenSplash() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markSplashSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // sessionStorage unavailable (private mode etc.) — just skip persisting.
  }
}

export default function SplashScreen() {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(() => !hasSeenSplash() && !reduceMotion);

  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(() => {
      setVisible(false);
      markSplashSeen();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [visible]);

  const dismiss = () => {
    setVisible(false);
    markSplashSeen();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="splash-screen"
          role="presentation"
          aria-hidden="true"
          onClick={dismiss}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        >
          <motion.span
            className="splash-word"
            dir="ltr"
            initial={{ opacity: 0, letterSpacing: "0.4em" }}
            animate={{ opacity: 1, letterSpacing: "-0.02em" }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            STRATIX
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
