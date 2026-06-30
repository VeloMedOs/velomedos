import { useEffect, useState } from "react";
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
 * When `?cms=preview` is on the URL AND the visitor has a portal-staff
 * session, draft rows are merged in too, so editors can review before publish.
 */
export function useSiteContent(locale: "en" | "ar" = "en") {
  const [content, setContent] = useState<ContentMap>({});
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    let cancel = false;
    const wantPreview = isCmsPreview();
    setPreview(wantPreview);
    (async () => {
      const headers: Record<string, string> = {};
      if (wantPreview) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) headers.authorization = `Bearer ${data.session.access_token}`;
      }
      const url = `/api/public/v1/site-content?locale=${locale}${wantPreview ? "&preview=1" : ""}`;
      try {
        const r = await fetch(url, { headers });
        const j = (await r.json().catch(() => null)) as { content?: ContentMap } | null;
        if (!cancel && j?.content) setContent(j.content);
      } catch { /* ignore */ }
    })();
    return () => { cancel = true; };
  }, [locale]);

  function get(key: string, fallback: string): string {
    const row = content[key];
    if (!row) return fallback;
    const v = row[locale] ?? row.en;
    if (typeof v === "string" && v.trim()) return v;
    return fallback;
  }

  return { get, preview, raw: content };
}
