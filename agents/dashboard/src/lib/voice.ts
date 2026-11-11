"use client";

/**
 * المكالمة الصوتية مع الفريق (زي وضع الصوت في شات جي بي تي):
 *
 * - التسجيل بصوتك الحقيقي، والتحويل لكلام مكتوب بـ Groq Whisper (بيفهم العامية كويس).
 * - مابنبعتش كلامك غير لما تسكت فعلًا مدة كافية (بتختارها)، ولو قلت «استنى / لحظة /
 *   ثانية» أو دوست «استنى، لسه بتكلم» بنفضل نسمع ومانبعتش.
 * - والفريق بيتكلم المايك بيبقى مقفول خالص: مستحيل يسمع صوتهم ويبعته تاني.
 * - كل رد بيتقري مرة واحدة بس (بنحفظ أرقام الرسايل اللي اتقرت).
 * - الصوت: Groq (صوت بشري طبيعي) لو متاح، وغير كده أحسن صوت عربي على الجهاز.
 */

import { supabase } from "./supabase";

// ── الأصوات ─────────────────────────────────────────────
const FEMALE = new Set(["analytics", "critic", "reviewer", "support", "writer"]);
const MALE_VOICES = ["fahad", "sultan", "abdullah"];
const FEMALE_VOICES = ["noura", "lulwa", "aisha"];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function voiceOf(agentId: string | null) {
  const id = agentId ?? "ceo";
  if (id === "ceo") return { groq: "fahad", female: false };
  const female = FEMALE.has(id);
  const list = female ? FEMALE_VOICES : MALE_VOICES;
  return { groq: list[hash(id) % list.length], female };
}

let groqVoice: "unknown" | "ok" | "off" = "unknown";
export let groqVoiceProblem = "";

async function groqSpeech(text: string, voice: string): Promise<Blob | null> {
  if (groqVoice === "off") return null;
  const { data, error } = await supabase().functions.invoke("voice", { body: { action: "tts", text, voice } });
  if (error || !(data instanceof Blob)) {
    try {
      const body = await (error as { context?: Response } | null)?.context?.json();
      if (body?.fallback) {
        groqVoice = "off";
        groqVoiceProblem = body.code === "terms" ? "terms" : "unavailable";
      }
    } catch {
      /* نجرّب المرة الجاية */
    }
    return null;
  }
  groqVoice = "ok";
  return data;
}

// أحسن صوت عربي على الجهاز: الأصوات "الطبيعية" (Natural/Online/Google) أحسن بكتير من العادية
function deviceVoice(female: boolean): SpeechSynthesisVoice | null {
  const voices = (typeof window !== "undefined" && window.speechSynthesis?.getVoices()) || [];
  const arabic = voices.filter(v => v.lang?.toLowerCase().startsWith("ar"));
  if (!arabic.length) return null;
  const score = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase();
    let s = 0;
    if (/natural|online|neural|premium|enhanced/.test(n)) s += 10;
    if (/google/.test(n)) s += 6;
    if (v.lang === "ar-EG") s += 4;
    const isFemale = /salma|zariyah|hoda|laila|amina|fatima|female|noura|mariam/.test(n);
    const isMale = /shakir|hamed|naayf|male|tarik|fahed|omar/.test(n);
    if (female ? isFemale : isMale) s += 3;
    return s;
  };
  return [...arabic].sort((a, b) => score(b) - score(a))[0];
}

function deviceSpeak(text: string, female: boolean, signal: { stopped: boolean }): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve();
  // كروم بيقطع الجمل الطويلة؛ فبنقرا جملة جملة
  const parts = text.replace(/[*_#`>|]/g, " ").split(/(?<=[.!؟?،\n])\s+/).map(p => p.trim()).filter(Boolean);
  const voice = deviceVoice(female);
  return parts.reduce<Promise<void>>((chain, part) => chain.then(() => new Promise<void>(resolve => {
    if (signal.stopped) return resolve();
    const u = new SpeechSynthesisUtterance(part);
    u.lang = voice?.lang ?? "ar-EG";
    if (voice) u.voice = voice;
    u.rate = 1;
    u.pitch = female ? 1.08 : 0.95;
    const done = () => { clearTimeout(guard); resolve(); };
    // لو onend ماجاش (بيحصل في كروم) مانعلّقش المكالمة
    const guard = setTimeout(done, 1500 + part.length * 120);
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
  })), Promise.resolve());
}

/** بيقرا الردود بالدور، كل رد مرة واحدة بس. */
export class Speaker {
  private queue: { id: number; text: string; agentId: string | null }[] = [];
  private spoken = new Set<number>();
  private audio: HTMLAudioElement | null = null;
  private signal = { stopped: false };
  playing = false;
  private running = false;
  /** طول ما ده بيرجع true (رئيس مجلس الإدارة بيتكلم) الفريق يستنى ومايقاطعهوش */
  waitWhile: () => boolean = () => false;
  onChange: (playing: boolean) => void = () => {};

  /** الرسايل اللي كانت موجودة قبل ما المكالمة تبدأ مابتتقريش */
  markSeen(ids: number[]) {
    ids.forEach(id => this.spoken.add(id));
  }

  enqueue(id: number, text: string, agentId: string | null) {
    if (this.spoken.has(id) || !text.trim()) return;
    this.spoken.add(id);
    this.queue.push({ id, text, agentId });
    void this.run();
  }

  stop() {
    this.queue = [];
    this.signal.stopped = true;
    this.running = false; // الصوت اللي اتوقف ممكن مايبلّغش إنه خلص، فنسمح بتشغيل جديد على طول
    this.audio?.pause();
    this.audio = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    this.setPlaying(false);
  }

  private setPlaying(p: boolean) {
    this.playing = p;
    this.onChange(p);
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    this.signal = { stopped: false };
    const signal = this.signal;
    while (this.queue.length && !signal.stopped) {
      // مانقاطعش حد بيتكلم: نستنى لحد ما يخلص كلامه
      while (this.waitWhile() && !signal.stopped) await new Promise(r => setTimeout(r, 200));
      if (signal.stopped || !this.queue.length) break;
      if (!this.playing) this.setPlaying(true);
      const item = this.queue.shift()!;
      const v = voiceOf(item.agentId);
      const blob = await groqSpeech(item.text, v.groq);
      if (signal.stopped) break;
      if (blob) {
        await new Promise<void>(resolve => {
          const url = URL.createObjectURL(blob);
          const a = new Audio(url);
          this.audio = a;
          const done = () => { URL.revokeObjectURL(url); resolve(); };
          a.onended = done;
          a.onerror = done;
          a.play().catch(done);
        });
      } else {
        await deviceSpeak(item.text, v.female, signal);
      }
    }
    if (this.signal !== signal) return; // اتوقف واتشغّل تشغيل أحدث مكانه
    this.running = false;
    this.setPlaying(false);
    if (this.queue.length) void this.run();
  }
}

// ── التسجيل ─────────────────────────────────────────────
export async function transcribe(blob: Blob): Promise<string> {
  const form = new FormData();
  const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", blob, `speech.${ext}`);
  const { data, error } = await supabase().functions.invoke("voice", { body: form });
  if (error) throw new Error("مقدرتش أفهم التسجيل، جرّب تاني");
  return String((data as { text?: string })?.text ?? "").trim();
}

// لو قال كده يبقى لسه مكمّل
const HOLD = /(استن[ىيا]|لحظ[ةه]|ثاني[ةه]|ثواني|دقيق[ةه]|خليني اكمل|خليني أكمل|مش خلصت|لسه بتكلم|اسمعني)[\s.!؟?،]*$/;
// هلوسة معروفة لـ Whisper لما التسجيل يكون سكوت
const NOISE = /^(شكرا(ً)? (لكم|للمشاهدة)|ترجمة نانسي|اشترك(وا)? في القناة|\.+|)$/;

export type ListenerState = "off" | "waiting" | "hearing" | "transcribing";

/**
 * بيسمع لحد ما تخلص كلامك فعلًا:
 * - بيستنى تسكت `silenceMs` (افتراضي 2.5 ثانية) بعد ما تبدأ تتكلم.
 * - لو `hold` شغال مابيبعتش خالص لحد ما تدوس «ابعت».
 * - بيجمّع كل مقاطع كلامك ويبعتهم مرة واحدة.
 */
export class Listener {
  state: ListenerState = "off";
  silenceMs = 3500;
  /** مستوى الصوت الحالي من 0 لـ 1 (للمؤشر في الشاشة) */
  level = 0;
  hold = false;
  onState: (s: ListenerState) => void = () => {};
  onPartial: (text: string) => void = () => {};
  onUtterance: (text: string) => void = () => {};
  onError: (msg: string) => void = () => {};

  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private floor = 0.004;
  private loud: number[] = [];
  private spokeAt = 0;
  private lastVoice = 0;
  private startedAt = 0;
  private pending = "";
  private sendNow = false;
  private onVisible: (() => void) | null = null;

  async open() {
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.ctx = new AudioContext();
    // الموبايل بيبدأ الصوت «موقوف» لحد ما يتعمل resume؛ من غيره المايك مابيسمعش حاجة
    await this.ctx.resume().catch(() => {});
    // لو المايك اتقفل من الجهاز (سماعة اتشالت مثلًا) نفتحه تاني بدل ما نقف
    this.stream.getAudioTracks().forEach(t => (t.onended = () => {
      this.stream = null;
      if (this.recorder) { this.pause(); void this.listen(); }
    }));
    // الموبايل بيوقّف الصوت لما الشاشة تقفل أو تروح لتطبيق تاني؛ لما ترجع نشغّله تاني
    if (!this.onVisible) {
      this.onVisible = () => { if (document.visibilityState === "visible") void this.ctx?.resume().catch(() => {}); };
      document.addEventListener("visibilitychange", this.onVisible);
    }
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    source.connect(this.analyser);
  }

  close() {
    this.pause();
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    void this.ctx?.close();
    this.ctx = null;
    this.pending = "";
    this.onPartial("");
  }

  /** يبدأ يسمع (المايك مفتوح) */
  async listen() {
    if (this.recorder) return;
    try {
      await this.open();
    } catch {
      this.onError("لازم تسمح للموقع يستخدم المايك (من علامة القفل جنب العنوان)");
      return;
    }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find(t => MediaRecorder.isTypeSupported?.(t));
    const rec = new MediaRecorder(this.stream!, mime ? { mimeType: mime } : undefined);
    this.recorder = rec;
    this.chunks = [];
    rec.ondataavailable = e => e.data.size && this.chunks.push(e.data);
    rec.start(250);
    await this.ctx?.resume().catch(() => {});
    this.startedAt = performance.now();
    this.spokeAt = 0;
    this.lastVoice = 0;
    this.loud = [];
    this.sendNow = false;
    this.set("waiting");
    const data = new Float32Array(this.analyser!.fftSize);
    this.timer = setInterval(() => {
      this.analyser!.getFloatTimeDomainData(data);
      let sum = 0;
      for (const x of data) sum += x * x;
      const rms = Math.sqrt(sum / data.length);
      const now = performance.now();
      this.level = Math.min(1, rms * 12);
      // دوشة المكان = أهدى صوت اتسمع في آخر ثواني (مش أعلى صوت)، عشان لو بدأت تتكلم
      // على طول صوتك مايتحسبش دوشة. وبنخليها ماتعلاش أوي عشان المايك يفضل حساس.
      this.loud.push(rms);
      if (this.loud.length > 60) this.loud.shift();
      const sorted = [...this.loud].sort((a, b) => a - b);
      this.floor = Math.min(0.012, Math.max(0.002, sorted[Math.floor(sorted.length * 0.1)] ?? 0.004));
      const voiced = rms > Math.max(this.floor * 3, 0.008);
      if (voiced) {
        if (!this.spokeAt) this.spokeAt = now;
        this.lastVoice = now;
        if (this.state !== "hearing") this.set("hearing");
      }
      const silentFor = this.lastVoice ? now - this.lastVoice : 0;
      // لازم تكون اتكلمت ثانية على الأقل قبل ما نبعت لوحدنا
      const longEnough = this.spokeAt && now - this.spokeAt > 1000;
      if (this.sendNow || (!this.hold && longEnough && silentFor > this.silenceMs) || now - this.startedAt > 120_000) {
        void this.finishSegment();
      }
    }, 100);
  }

  /** «خلصت، ابعت» */
  sendImmediately() {
    if (this.recorder) this.sendNow = true;
    else if (this.pending) this.deliver();
  }

  /** يقفل المايك من غير ما يبعت (الفريق بيتكلم مثلًا) */
  pause() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.ondataavailable = null;
      this.recorder.stop();
    }
    this.recorder = null;
    this.set("off");
  }

  private set(s: ListenerState) {
    this.state = s;
    this.onState(s);
  }

  private async finishSegment() {
    const rec = this.recorder;
    if (!rec) return;
    const forced = this.sendNow;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.recorder = null;
    const spoke = this.spokeAt > 0;
    await new Promise<void>(resolve => {
      rec.onstop = () => resolve();
      rec.stop();
    });
    const blob = new Blob(this.chunks, { type: rec.mimeType || "audio/webm" });
    this.chunks = [];
    if (spoke && blob.size > 2000) {
      this.set("transcribing");
      try {
        const text = await transcribe(blob);
        if (text && !NOISE.test(text)) {
          this.pending = (this.pending ? `${this.pending} ` : "") + text;
          this.onPartial(this.pending);
        }
      } catch (e) {
        this.onError((e as Error).message);
      }
    }
    // قال «استنى» أو لسه ماقالش حاجة؟ نكمّل نسمع
    if (!forced && (!this.pending || HOLD.test(this.pending) || this.hold)) {
      await this.listen();
      return;
    }
    this.deliver();
  }

  private deliver() {
    const text = this.pending.replace(HOLD, "").trim();
    this.pending = "";
    this.onPartial("");
    this.set("off");
    if (text) this.onUtterance(text);
  }
}

/** تسجيل بسيط بزرار (للكتابة بالصوت في الشات): دوس يسجّل، دوس تاني يكتب الكلام. */
export class Dictation {
  private listener = new Listener();
  active = false;
  onText: (t: string) => void = () => {};
  onState: (s: ListenerState) => void = () => {};
  onError: (m: string) => void = () => {};

  constructor() {
    this.listener.hold = true; // مابيبعتش لوحده: انت اللي بتدوس توقف
    this.listener.onState = s => this.onState(s);
    this.listener.onError = m => this.onError(m);
    this.listener.onUtterance = t => {
      this.active = false;
      this.listener.close();
      this.onText(t);
    };
  }

  async start() {
    this.active = true;
    await this.listener.listen();
  }

  stop() {
    this.listener.sendImmediately();
  }

  cancel() {
    this.active = false;
    this.listener.close();
  }
}
