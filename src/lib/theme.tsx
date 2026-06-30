import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ThemePref = "light" | "dark" | "auto";
export type ThemeResolved = "light" | "dark";
export type AccentId = "teal" | "sky" | "coral" | "violet" | "amber" | "emerald" | "rose";

export const ACCENTS: ReadonlyArray<{ id: AccentId; label: string; swatch: string }> = [
  { id: "teal",    label: "Teal",    swatch: "#28D6B6" },
  { id: "sky",     label: "Sky",     swatch: "#4FB6F7" },
  { id: "coral",   label: "Coral",   swatch: "#FF6E5B" },
  { id: "violet",  label: "Violet",  swatch: "#A78BFA" },
  { id: "amber",   label: "Amber",   swatch: "#F5B544" },
  { id: "emerald", label: "Emerald", swatch: "#34D399" },
  { id: "rose",    label: "Rose",    swatch: "#FB7185" },
];

const THEME_KEY = "velomed.theme";
const ACCENT_KEY = "velomed.accent";

type Ctx = {
  theme: ThemePref;
  resolved: ThemeResolved;
  setTheme: (t: ThemePref) => void;
  accent: AccentId;
  setAccent: (a: AccentId) => void;
};

const ThemeContext = createContext<Ctx | null>(null);

function isAccent(v: unknown): v is AccentId {
  return typeof v === "string" && ACCENTS.some((a) => a.id === v);
}
function readTheme(): ThemePref {
  if (typeof window === "undefined") return "auto";
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" || v === "auto" ? v : "auto";
  } catch { return "auto"; }
}
function readAccent(): AccentId {
  if (typeof window === "undefined") return "teal";
  try { const v = window.localStorage.getItem(ACCENT_KEY); return isAccent(v) ? v : "teal"; }
  catch { return "teal"; }
}
function systemPrefers(): ThemeResolved {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
function resolve(pref: ThemePref): ThemeResolved {
  return pref === "auto" ? systemPrefers() : pref;
}
function applyTheme(resolved: ThemeResolved) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.toggle("light", resolved === "light");
  html.classList.toggle("dark", resolved === "dark");
  html.style.colorScheme = resolved;
}
function applyAccent(accent: AccentId) {
  if (typeof document === "undefined") return;
  // `teal` is the default; clearing the attribute keeps the original brand tokens.
  if (accent === "teal") document.documentElement.removeAttribute("data-accent");
  else document.documentElement.setAttribute("data-accent", accent);
}

/** No-flash inline script. Mirrors the runtime apply functions above so the
 *  correct theme + accent are painted before React mounts. */
export const NO_FLASH_SCRIPT = `(()=>{try{var s=localStorage.getItem('${THEME_KEY}');var p=(s==='light'||s==='dark'||s==='auto')?s:'auto';var r=p==='auto'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p;var h=document.documentElement;h.classList.toggle('light',r==='light');h.classList.toggle('dark',r==='dark');h.style.colorScheme=r;var a=localStorage.getItem('${ACCENT_KEY}');var allow=['teal','sky','coral','violet','amber','emerald','rose'];if(a&&allow.indexOf(a)>-1&&a!=='teal'){h.setAttribute('data-accent',a);}else{h.removeAttribute('data-accent');}}catch(e){}})();`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(() => readTheme());
  const [accent, setAccentState] = useState<AccentId>(() => readAccent());
  const [resolved, setResolved] = useState<ThemeResolved>(() => resolve(readTheme()));
  const synced = useRef(false);

  useEffect(() => {
    const r = resolve(theme);
    setResolved(r);
    applyTheme(r);
    if (theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => { const next = resolve("auto"); setResolved(next); applyTheme(next); };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  useEffect(() => { applyAccent(accent); }, [accent]);

  // Hydrate from profile once per session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || synced.current || cancelled) return;
      synced.current = true;
      const { data: row } = await supabase
        .from("profiles")
        .select("theme_preference, accent_preference")
        .eq("id", user.id)
        .maybeSingle();
      const r = row as { theme_preference?: ThemePref; accent_preference?: AccentId } | null;
      if (r?.theme_preference && r.theme_preference !== theme) {
        try { localStorage.setItem(THEME_KEY, r.theme_preference); } catch { /* noop */ }
        setThemeState(r.theme_preference);
      }
      if (r?.accent_preference && isAccent(r.accent_preference) && r.accent_preference !== accent) {
        try { localStorage.setItem(ACCENT_KEY, r.accent_preference); } catch { /* noop */ }
        setAccentState(r.accent_preference);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback((t: ThemePref) => {
    setThemeState(t);
    try { localStorage.setItem(THEME_KEY, t); } catch { /* noop */ }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("profiles").update({ theme_preference: t }).eq("id", user.id);
    })().catch(() => {});
  }, []);

  const setAccent = useCallback((a: AccentId) => {
    setAccentState(a);
    try { localStorage.setItem(ACCENT_KEY, a); } catch { /* noop */ }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("profiles").update({ accent_preference: a }).eq("id", user.id);
    })().catch(() => {});
  }, []);

  const ctx = useMemo<Ctx>(() => ({ theme, resolved, setTheme, accent, setAccent }), [theme, resolved, setTheme, accent, setAccent]);
  return <ThemeContext.Provider value={ctx}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Ctx {
  const v = useContext(ThemeContext);
  if (!v) {
    return {
      theme: "auto", resolved: "dark", setTheme: () => {},
      accent: "teal", setAccent: () => {},
    };
  }
  return v;
}
