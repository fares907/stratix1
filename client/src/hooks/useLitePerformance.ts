import { useEffect, useState, type RefObject } from "react";

/**
 * True while the element is on screen, used to pause forever-looping
 * animations that would otherwise keep the compositor busy off screen.
 *
 * Deliberately defaults to `true` and only ever flips to `false` once the
 * observer actively reports the element as off screen. If IntersectionObserver
 * is unsupported or never fires, the animation keeps running exactly as it did
 * before — a missed optimisation rather than a hero animation that silently
 * never starts.
 */
export function useOnScreen(ref: RefObject<Element | null>): boolean {
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      entries => setOnScreen(entries[0]?.isIntersecting ?? true),
      // Keep animating slightly beyond the fold so nothing visibly snaps into
      // motion at the moment it scrolls into view.
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return onScreen;
}

/**
 * Detects devices that will struggle with the site's continuous animations and
 * full-screen grain filter, and flags them on <html data-lite="true"> so CSS can
 * drop the expensive effects.
 *
 * The signals are deliberately conservative — we only opt a device *into* lite
 * mode on clear evidence, so a capable phone never loses the design. Both APIs
 * are absent on some browsers (notably Safari), which correctly falls through to
 * the full experience rather than degrading everyone by guessing.
 */
function detectLowPowerDevice(): boolean {
  if (typeof navigator === "undefined") return false;

  // Chromium-only, reports GB of RAM (rounded down, capped at 8).
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof memory === "number" && memory <= 4) return true;

  // Widely supported. Low core counts on a touch device signal a budget phone;
  // low core counts on desktop are usually a VM, which handles this fine.
  const cores = navigator.hardwareConcurrency;
  const isCoarsePointer =
    typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  if (typeof cores === "number" && cores <= 4 && isCoarsePointer) return true;

  return false;
}

export function useLitePerformance(): boolean {
  const [lite, setLite] = useState(false);

  useEffect(() => {
    const isLite = detectLowPowerDevice();
    setLite(isLite);
    if (isLite) {
      document.documentElement.setAttribute("data-lite", "true");
    }
  }, []);

  return lite;
}
