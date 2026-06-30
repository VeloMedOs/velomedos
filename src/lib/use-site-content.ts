import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type ContentMap = Record<string, Record<string, unknown>>;

/** Detect ?cms=preview on the URL (client only). */
export function isCmsPreview(): boolean {
  if (typeof window === "undefined") return false;
  try { return new URLSearchParams(window.location.search).get("cms") === "preview"; }
  catch { return false; }
}

/**
 * Reads the marketing-site CMS overlay published from Superadmin.
 *
 * - In preview mode (`?cms=preview` + portal-staff session), drafts shadow
 *   published values so editors can review before going live.
 * - In normal mode, only published values are returned.
 *
 * The hook revalidates whenever:
 *  • the tab becomes visible again (focus / visibilitychange)
 *  • a 60s heartbeat fires
 *  • the parent calls `revalidate()` explicitly
 *
 * The public API serves `ETag: "v<version>"`; we send the cached version back
 * as `If-None-Match` so an unchanged response is a cheap 304.
 */
export function useSiteContent(locale: "en" | "ar" = "en") {
  const [content, setContent] = useState<ContentMap>({});
  const [preview, setPreview] = useState(false);
  const [version, setVersion] = useState<number | null>(null);
  const etagRef = useRef<string | null>(null);

  const fetchOnce = useCallback(async () => {
    const wantPreview = isCmsPreview();
    setPreview(wantPreview);
    const headers: Record<string, string> = {};
    if (wantPreview) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) headers.authorization = `Bearer ${data.session.access_token}`;
    }
    if (etagRef.current) headers["if-none-match"] = etagRef.current;
    const url = `/api/public/v1/site-content?locale=${locale}${wantPreview ? "&preview=1" : ""}`;
    try {
      const r = await fetch(url, { headers, cache: "no-store" });
      if (r.status === 304) return;
      const tag = r.headers.get("etag");
      if (tag) etagRef.current = tag;
      const j = (await r.json().catch(() => null)) as
        | { content?: ContentMap; version?: number } | null;
      if (j?.content) setContent(j.content);
      if (typeof j?.version === "number") setVersion(j.version);
    } catch { /* ignore */ }
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    void fetchOnce();
    const onFocus = () => { if (!cancelled && document.visibilityState !== "hidden") void fetchOnce(); };
    const onVis = () => { if (!cancelled && document.visibilityState === "visible") void fetchOnce(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const t = window.setInterval(() => { if (!cancelled) void fetchOnce(); }, 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(t);
    };
  }, [fetchOnce]);

  function get(key: string, fallback: string): string {
    const row = content[key];
    if (!row) return fallback;
    const v = row[locale] ?? row.en;
    if (typeof v === "string" && v.trim()) return v;
    return fallback;
  }

  return { get, preview, version, raw: content, revalidate: fetchOnce };
}
