import { useEffect, useRef } from "react";

/**
 * Debounced effect. Fires `fn(value)` once `delay` ms have elapsed
 * after the most recent change to `value`. Skips the very first call
 * unless `runOnMount` is true.
 */
export function useDebouncedEffect<T>(
  value: T,
  delay: number,
  fn: (v: T) => void,
  { runOnMount = false }: { runOnMount?: boolean } = {},
) {
  const mounted = useRef(false);
  useEffect(() => {
    if (!runOnMount && !mounted.current) { mounted.current = true; return; }
    const t = setTimeout(() => fn(value), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay]);
}

/**
 * Read / write a JSON value to localStorage. SSR-safe.
 */
export const draftStore = {
  read<T>(key: string): T | null {
    if (typeof window === "undefined") return null;
    try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
  },
  write<T>(key: string, v: T) {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* quota */ }
  },
  clear(key: string) {
    if (typeof window === "undefined") return;
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};
