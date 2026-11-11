"use client";

// زرار المايك: دوس واتكلم، والكلام بيتكتب في الخانة. دوس تاني يوقف.
export function MicButton({ listening, supported, onStart, onStop, disabled }: {
  listening: boolean;
  supported: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}) {
  if (!supported) return null;
  return (
    <button
      type="button"
      className={listening ? "mic on" : "mic"}
      aria-label={listening ? "وقّف التسجيل" : "سجّل بصوتك"}
      title={listening ? "وقّف التسجيل" : "سجّل بصوتك"}
      disabled={disabled}
      onClick={listening ? onStop : onStart}
    >
      {listening ? "■" : "🎙"}
    </button>
  );
}
