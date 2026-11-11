"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// الصوت كله من المتصفح نفسه (مجاني، من غير أي سيرفر): كروم على الموبايل والكمبيوتر بيدعمه.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Recognition = any;

function makeRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = "ar-EG";
  r.continuous = true;
  r.interimResults = true;
  return r;
}

/**
 * تسجيل صوتي بيتحول لكلام مكتوب.
 * onFinal بيتنده لما تسكت بعد جملة (في وضع المكالمة بنبعت الكلام لوحده).
 */
export function useDictation(onText: (text: string) => void, onFinal?: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState("");
  const rec = useRef<Recognition | null>(null);
  const base = useRef("");
  const handlers = useRef({ onText, onFinal });
  handlers.current = { onText, onFinal };

  useEffect(() => {
    setSupported(Boolean(makeRecognition()));
    return () => rec.current?.abort?.();
  }, []);

  const stop = useCallback(() => {
    rec.current?.stop?.();
    setListening(false);
  }, []);

  const start = useCallback((initial = "") => {
    const r = makeRecognition();
    if (!r) {
      setSupported(false);
      return;
    }
    rec.current?.abort?.();
    rec.current = r;
    base.current = initial ? initial.trimEnd() + " " : "";
    setError("");
    r.onresult = (e: any) => {
      let finalText = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      const text = (base.current + finalText + interim).trim();
      handlers.current.onText(text);
      if (handlers.current.onFinal && finalText && !interim) {
        handlers.current.onFinal((base.current + finalText).trim());
        base.current = "";
        r.stop();
      }
    };
    r.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setError("لازم تسمح للموقع يستخدم المايك من إعدادات المتصفح");
      else if (e.error !== "no-speech" && e.error !== "aborted") setError("المايك وقف، دوس تاني");
    };
    r.onend = () => setListening(false);
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  return { listening, supported, error, start, stop };
}

let arabicVoice: SpeechSynthesisVoice | null | undefined;
function pickVoice(): SpeechSynthesisVoice | null {
  if (arabicVoice !== undefined && arabicVoice !== null) return arabicVoice;
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  arabicVoice = voices.find(v => v.lang === "ar-EG") ?? voices.find(v => v.lang?.startsWith("ar")) ?? null;
  return arabicVoice;
}

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** يقرا الكلام بصوت عالي بالعربي. بيرجّع Promise بتخلص لما يخلص كلام. */
export function speak(text: string, opts: { pitch?: number; rate?: number } = {}): Promise<void> {
  if (!canSpeak() || !text.trim()) return Promise.resolve();
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text.replace(/[#*_`>]/g, " "));
    u.lang = "ar-EG";
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = opts.rate ?? 1.05;
    u.pitch = opts.pitch ?? 1;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export const stopSpeaking = () => canSpeak() && window.speechSynthesis.cancel();

/** كل موظف بطبقة صوت مختلفة شوية عشان تفرّق بينهم */
export function voiceFor(agentId: string | null): { pitch: number; rate: number } {
  if (!agentId) return { pitch: 1, rate: 1.05 };
  let h = 0;
  for (const c of agentId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { pitch: 0.8 + (h % 9) * 0.06, rate: 0.98 + (h % 5) * 0.04 };
}
