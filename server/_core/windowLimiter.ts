// Fixed-window counter keyed by visitor. Memory is capped because keys come
// from the network: expired windows are swept first, then the oldest entries.
export function createWindowLimiter(options: { windowMs: number; max: number; maxKeys?: number }) {
  const maxKeys = options.maxKeys ?? 10_000;
  const windows = new Map<string, { count: number; start: number }>();

  function prune(now: number) {
    if (windows.size < maxKeys) return;
    windows.forEach((entry, key) => {
      if (now - entry.start > options.windowMs) windows.delete(key);
    });
    for (const key of windows.keys()) {
      if (windows.size < maxKeys) break;
      windows.delete(key);
    }
  }

  return {
    isLimited(key: string, now = Date.now()) {
      const entry = windows.get(key);
      return !!entry && now - entry.start <= options.windowMs && entry.count >= options.max;
    },
    record(key: string, now = Date.now()) {
      prune(now);
      const entry = windows.get(key);
      if (!entry || now - entry.start > options.windowMs) {
        windows.set(key, { count: 1, start: now });
      } else {
        entry.count += 1;
      }
    },
  };
}
