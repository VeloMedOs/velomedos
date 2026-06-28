// Tiny client-side store for the in-app debug overlay. Toggled by
// `?debug=1` (sticky in localStorage) or by the floating chip rendered
// by <DebugOverlay />. Components opt-in by tagging elements with
// `data-debug-id="…"` — the overlay then draws bounding boxes,
// anchor points, and z-index labels for every tagged node so we can
// verify ETA bubbles and destination markers never stack incorrectly.

const KEY = "velomed:debug-overlay";

type Listener = (on: boolean) => void;
const listeners = new Set<Listener>();

let state = false;

if (typeof window !== "undefined") {
  try {
    const url = new URL(window.location.href);
    const flag = url.searchParams.get("debug");
    if (flag === "1") localStorage.setItem(KEY, "1");
    if (flag === "0") localStorage.removeItem(KEY);
    state = localStorage.getItem(KEY) === "1";
  } catch { /* ssr / private mode — ignore */ }
}

export function isDebugOn(): boolean { return state; }
export function setDebugOn(on: boolean) {
  state = on;
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch { /* noop */ }
  listeners.forEach((l) => l(state));
}
export function subscribeDebug(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export async function reportDebugEvent(input: {
  source?: "overlay" | "console" | "playwright" | "api" | "manual";
  kind: "glitch" | "snapshot" | "metric" | "error" | "info";
  severity?: "info" | "warn" | "error" | "critical";
  message?: string;
  payload?: Record<string, unknown>;
  tenant_id?: string | null;
}) {
  try {
    const route = typeof window !== "undefined" ? window.location.pathname + window.location.search : null;
    const viewport = typeof window !== "undefined"
      ? (window.innerWidth < 640 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop")
      : null;
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("debug_events").insert({
      tenant_id: input.tenant_id ?? null,
      source: input.source ?? "overlay",
      kind: input.kind,
      severity: input.severity ?? "info",
      route, viewport,
      message: input.message ?? null,
      payload: (input.payload ?? {}) as never,
      created_by: user?.id ?? null,
    });
  } catch { /* best-effort */ }
}