import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type HeroMode = "operations" | "care";
const STORAGE_KEY = "velomed.heroMode";

type Ctx = { mode: HeroMode; setMode: (m: HeroMode) => void };
const HeroModeCtx = createContext<Ctx | null>(null);

function readInitial(): HeroMode {
  if (typeof window === "undefined") return "operations";
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("mode");
    if (q === "care" || q === "operations") return q;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "care" || saved === "operations") return saved;
  } catch {}
  return "operations";
}

export function HeroModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<HeroMode>("operations");

  // Hydrate on mount (avoids SSR mismatch).
  useEffect(() => { setModeState(readInitial()); }, []);

  // React to ?mode= changes from cross-route navigation.
  useEffect(() => {
    const onPop = () => setModeState(readInitial());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setMode = useCallback((m: HeroMode) => {
    setModeState(m);
    try { window.localStorage.setItem(STORAGE_KEY, m); } catch {}
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <HeroModeCtx.Provider value={value}>{children}</HeroModeCtx.Provider>;
}

export function useHeroMode(): Ctx {
  const ctx = useContext(HeroModeCtx);
  if (ctx) return ctx;
  // Safe fallback for trees rendered before the provider mounts.
  return { mode: "operations", setMode: () => {} };
}