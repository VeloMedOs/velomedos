import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ThemePref = "light" | "dark" | "auto";
export type ThemeResolved = "light" | "dark";

const STORAGE_KEY = "velomed.theme";

type Ctx = {
  theme: ThemePref;
  resolved: ThemeResolved;
  setTheme: (t: ThemePref) => void;
};

const ThemeContext = createContext<Ctx | null>(null);

function readStored(): ThemePref {
  if (typeof window === "undefined") return "auto";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" || v === "auto" ? v : "auto";
  } catch { return "auto"; }
}
function systemPrefers(): ThemeResolved {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
function resolve(pref: ThemePref): ThemeResolved {
  return pref === "auto" ? systemPrefers() : pref;
}
function apply(resolved: ThemeResolved) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.toggle("light", resolved === "light");
  html.classList.toggle("dark", resolved === "dark");
  html.style.colorScheme = resolved;
}

/** Inline script — run before React mounts so the right theme is applied
 *  on first paint with no flash. Mirrored at runtime by ThemeProvider. */
export const NO_FLASH_SCRIPT = `(()=>{try{var s=localStorage.getItem('${STORAGE_KEY}');var p=(s==='light'||s==='dark'||s==='auto')?s:'auto';var r=p==='auto'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p;var h=document.documentElement;h.classList.toggle('light',r==='light');h.classList.toggle('dark',r==='dark');h.style.colorScheme=r;}catch(e){}})();`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(() => readStored());
  const [resolved, setResolved] = useState<ThemeResolved>(() => resolve(readStored()));
  const synced = useRef(false);

  // Apply whenever the preference changes; keep listening to OS in Auto mode.
  useEffect(() => {
    const r = resolve(theme);
    setResolved(r);
    apply(r);
    if (theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => { const next = resolve("auto"); setResolved(next); apply(next); };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  // On first sign-in, hydrate from profiles.theme_preference (server wins once).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || synced.current || cancelled) return;
      synced.current = true;
      const { data: row } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("id", user.id)
        .maybeSingle();
      const remote = (row as { theme_preference?: ThemePref } | null)?.theme_preference;
      if (remote && remote !== theme) {
        try { localStorage.setItem(STORAGE_KEY, remote); } catch { /* noop */ }
        setThemeState(remote);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback((t: ThemePref) => {
    setThemeState(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch { /* noop */ }
    // Best-effort sync to profile; ignore failures (anon users, RLS).
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("profiles").update({ theme_preference: t }).eq("id", user.id);
    })().catch(() => {});
  }, []);

  const ctx = useMemo<Ctx>(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);
  return <ThemeContext.Provider value={ctx}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Ctx {
  const v = useContext(ThemeContext);
  if (!v) {
    // Safe fallback for trees that haven't mounted the provider yet
    // (e.g. error boundaries during SSR).
    return { theme: "auto", resolved: "dark", setTheme: () => {} };
  }
  return v;
}
