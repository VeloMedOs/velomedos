/** Fire-and-forget navigation click telemetry. Uses sendBeacon when available
 *  so navigation isn't delayed; falls back to keepalive fetch. Safe to call
 *  inside Link onClick handlers — never throws, never awaits. */
export function trackNavClick(args: {
  event_name: string;
  target_path: string;
  surface: "header" | "footer" | "sidebar" | "inline" | "mobile";
  locale?: string;
}) {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      ...args,
      referrer: window.location.pathname + window.location.search,
    });
    const url = "/api/public/telemetry/nav-click";
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }
    void fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
  } catch { /* never block navigation */ }
}