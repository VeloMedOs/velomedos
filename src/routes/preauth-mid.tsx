/**
 * Step 4 · Turn 3 — Pre-Auth MID public kiosk page (HCA-0978).
 * No sign-in. Reads /api/public/v1/preauth-mid/board?tenant=<uuid|slug>.
 * Auto-refresh every 30s. EN/AR toggle. Displays only the 9 safe fields.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

type BoardRow = {
  id: string;
  masked_ref: string | null;
  status: string;
  status_color: "white" | "amber" | "green" | "teal" | "red";
  decision_at: string | null;
  valid_to: string | null;
  priority: string | null;
  updated_at: string;
};

const L = {
  en: {
    title: "Pre-Authorization Status Board",
    subtitle: "Live status for today's requests. No patient details shown.",
    ref: "Reference", status: "Status", updated: "Updated", empty: "No active requests.",
    langBtn: "AR",
  },
  ar: {
    title: "لوحة حالة الموافقة المسبقة",
    subtitle: "الحالات المباشرة لطلبات اليوم. لا تُعرض بيانات المرضى.",
    ref: "المرجع", status: "الحالة", updated: "آخر تحديث", empty: "لا توجد طلبات نشطة.",
    langBtn: "EN",
  },
};

const STATUS_LABEL: Record<string, { en: string; ar: string }> = {
  new: { en: "Raised", ar: "مُنشأ" },
  scrubbing: { en: "Raised", ar: "مُنشأ" },
  ready_to_submit: { en: "Raised", ar: "مُنشأ" },
  submitted: { en: "Pending", ar: "تحت الإجراء" },
  queued_at_payer: { en: "Pending", ar: "تحت الإجراء" },
  in_review: { en: "Pending", ar: "تحت الإجراء" },
  more_info_requested: { en: "Pending", ar: "تحت الإجراء" },
  approved: { en: "Approved", ar: "معتمد" },
  appeal_approved: { en: "Approved", ar: "معتمد" },
  partially_approved: { en: "Partially Approved", ar: "معتمد جزئياً" },
  rejected: { en: "Rejected", ar: "مرفوض" },
  appeal_rejected: { en: "Rejected", ar: "مرفوض" },
  expired: { en: "Expired", ar: "منتهي" },
};

const COLOR_CLASS: Record<BoardRow["status_color"], string> = {
  white: "bg-white text-slate-800 border border-slate-300",
  amber: "bg-amber-100 text-amber-900 border border-amber-300",
  green: "bg-emerald-100 text-emerald-900 border border-emerald-300",
  teal:  "bg-teal-100 text-teal-900 border border-teal-300",
  red:   "bg-rose-100 text-rose-900 border border-rose-300",
};

function KioskPage() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [ts, setTs] = useState<string | null>(null);
  const tenant = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("tenant") ?? "";
  }, []);
  const t = L[lang];

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/public/v1/preauth-mid/board?tenant=${encodeURIComponent(tenant)}`);
        const j = await res.json();
        if (!alive) return;
        setRows((j.rows ?? []) as BoardRow[]);
        setTs(j.generated_at ?? null);
      } catch { /* retry on next tick */ }
    }
    load();
    const iv = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(iv); };
  }, [tenant]);

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-slate-50 text-slate-900 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">{t.title}</h1>
            <p className="text-sm text-slate-600">{t.subtitle}</p>
          </div>
          <button
            className="text-sm px-3 py-1 rounded border border-slate-300 hover:bg-white"
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
          >{t.langBtn}</button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-600 uppercase text-[11px] tracking-widest">
              <tr>
                <th className="p-3 text-start">{t.ref}</th>
                <th className="p-3 text-start">{t.status}</th>
                <th className="p-3 text-start">{t.updated}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={3} className="p-8 text-center text-slate-500">{t.empty}</td></tr>
              )}
              {rows.map((r) => {
                const label = STATUS_LABEL[r.status]?.[lang] ?? r.status;
                return (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="p-3 font-mono">{r.masked_ref ?? "—"}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${COLOR_CLASS[r.status_color]}`}>
                        {label}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">
                      {new Date(r.updated_at).toLocaleTimeString(lang === "ar" ? "ar-SA" : "en-US")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {ts && (
          <p className="mt-4 text-xs text-slate-500 text-center">
            {new Date(ts).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}
          </p>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/preauth-mid")({
  head: () => ({
    meta: [
      { title: "Pre-Authorization Status Board" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: KioskPage,
});