import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { LegalRenderer } from "./LegalRenderer";
import { ShieldCheck, FileText, HeartPulse, UserCheck, Printer, Languages, Check } from "lucide-react";
import type { LegalDoc } from "@/lib/legal.functions";
import { trackNavClick } from "@/lib/track-nav";

const NAV: { to: string; label: string; labelAr: string; icon: any; key: string }[] = [
  { to: "/Privacy/Home",           label: "Privacy",          labelAr: "الخصوصية",       icon: ShieldCheck, key: "privacy-home" },
  { to: "/Privacy/TermsOfService", label: "Terms of Service", labelAr: "شروط الخدمة",   icon: FileText,    key: "terms-of-service" },
  { to: "/Privacy/HIPAA",          label: "HIPAA Notice",     labelAr: "إشعار HIPAA",   icon: HeartPulse,  key: "hipaa" },
  { to: "/Privacy/PatientRights",  label: "Patient Rights",   labelAr: "حقوق المرضى",   icon: UserCheck,   key: "patient-rights" },
];

const ACCEPT_LS_PREFIX = "velomed.legal.accept.";
const ACCEPTABLE_KEYS = new Set(["privacy-home", "terms-of-service"]);

export function PrivacyShell({ doc, activeKey }: { doc: LegalDoc | null; activeKey: string }) {
  const search = useSearch({ strict: false }) as { locale?: string };
  const navigate = useNavigate();
  const locale = (search?.locale === "ar" ? "ar" : "en") as "en" | "ar";
  const rtl = locale === "ar";
  const articleRef = useRef<HTMLDivElement | null>(null);
  const [toc, setToc] = useState<{ id: string; text: string; level: number }[]>([]);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<number | null>(null);
  const acceptKey = doc ? `${ACCEPT_LS_PREFIX}${doc.slug}:${locale}` : "";

  // Build TOC from rendered h2/h3 after content paints.
  useEffect(() => {
    if (!articleRef.current) return;
    const headings = Array.from(articleRef.current.querySelectorAll("h2, h3")) as HTMLElement[];
    const items = headings.map((h, idx) => {
      const text = h.textContent ?? `Section ${idx + 1}`;
      const id = h.id || text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `s-${idx}`;
      h.id = id;
      return { id, text, level: h.tagName === "H2" ? 2 : 3 };
    });
    setToc(items);

    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActiveAnchor((visible.target as HTMLElement).id);
    }, { rootMargin: "-25% 0px -65% 0px", threshold: 0 });
    headings.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [doc?.body_md, locale]);

  // Read prior acceptance for this version.
  useEffect(() => {
    if (!doc || !ACCEPTABLE_KEYS.has(doc.slug)) { setAccepted(null); return; }
    try {
      const v = window.localStorage.getItem(acceptKey);
      setAccepted(v ? Number(v) : null);
    } catch { setAccepted(null); }
  }, [doc?.slug, doc?.version, acceptKey]);

  const switchLocale = (next: "en" | "ar") => {
    if (next === locale) return;
    navigate({ to: ".", search: (s: any) => ({ ...s, locale: next }) } as any);
  };

  const acknowledge = async () => {
    if (!doc) return;
    try {
      await fetch(`/api/public/legal/${doc.slug}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      window.localStorage.setItem(acceptKey, String(doc.version));
      setAccepted(doc.version);
    } catch { /* fail silently — non-blocking UX */ }
  };

  const showAcceptBar = doc && ACCEPTABLE_KEYS.has(doc.slug) && accepted !== doc.version;
  const arFont = rtl ? '"IBM Plex Sans Arabic","Noto Naskh Arabic",ui-serif,system-ui,sans-serif' : undefined;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="relative" dir={rtl ? "rtl" : "ltr"} style={arFont ? { fontFamily: arFont } as React.CSSProperties : undefined}>
        <div aria-hidden className="absolute inset-x-0 top-0 h-[420px] brand-wash pointer-events-none" />
        <div className="relative max-w-[1100px] mx-auto px-4 lg:px-8 py-14 grid lg:grid-cols-[240px_minmax(0,1fr)] gap-12">
        <aside className="lg:sticky lg:top-24 self-start print:hidden">
          <div className="brand-eyebrow mb-4"><span className="vital-dot" /> {rtl ? "المركز القانوني" : "Legal Center"}</div>
          <nav className="flex lg:flex-col gap-1 overflow-x-auto">
            {NAV.map((n) => {
              const active = n.key === activeKey;
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  search={{ locale } as any}
                  onClick={() => trackNavClick({ event_name: "privacy_sidebar_click", target_path: n.to, surface: "sidebar", locale })}
                  className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] whitespace-nowrap transition-all ${
                    active
                      ? "bg-panel-elevated text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.04)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-panel/60"
                  }`}
                >
                  {active && (
                    <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full" style={{ background: "var(--gradient-brand)" }} />
                  )}
                  <Icon className={`size-3.5 ${active ? "text-teal" : "text-muted-foreground group-hover:text-foreground"}`} />
                  {rtl ? n.labelAr : n.label}
                </Link>
              );
            })}
          </nav>

          {/* In-page TOC */}
          {toc.length > 0 && (
            <div className="mt-6 hidden lg:block">
              <div className="brand-eyebrow text-muted-foreground mb-2" style={{ color: "var(--color-muted-foreground)" }}>{rtl ? "في هذه الصفحة" : "On this page"}</div>
              <ul className="space-y-1.5 border-l border-hairline pl-3 text-[12px]">
                {toc.map((t) => (
                  <li key={t.id} className={t.level === 3 ? "pl-3" : ""}>
                    <a
                      href={`#${t.id}`}
                      className={`block py-0.5 leading-snug transition-colors ${
                        activeAnchor === t.id ? "text-teal" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >{t.text}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 rounded-lg border border-hairline bg-panel/70 p-3.5 hidden lg:block relative overflow-hidden">
            <div aria-hidden className="absolute -top-12 -right-12 size-32 rounded-full opacity-[0.08] blur-2xl" style={{ background: "var(--gradient-brand)" }} />
            <div className="brand-eyebrow text-muted-foreground" style={{ color: "var(--color-muted-foreground)" }}>{rtl ? "الامتثال" : "Compliance"}</div>
            <div className="text-[11px] text-foreground/85 mt-1.5 leading-5 relative">
              KSA PDPL · NDMO · NCA ECC-1 · MOH / NPHIES / CHI · HIPAA-aligned (optional BAA)
            </div>
            <a href="/resources/comparison" className="mt-3 block text-[10px] uppercase tracking-widest text-teal hover:underline relative">
              {rtl ? "قارن المنصات ←" : "Compare platforms →"}
            </a>
          </div>
        </aside>
        <article className="min-w-0">
          {doc ? (
            <>
              {/* Sub-header strip */}
              <div className="flex flex-wrap items-start justify-between gap-4 print:block">
                <div>
                  <div className="brand-eyebrow text-muted-foreground" style={{ color: "var(--color-muted-foreground)" }}>VeloMed OS · Legal</div>
                  <h1 className="font-serif text-4xl lg:text-5xl tracking-tight mt-2 leading-[1.05]">{doc.title}</h1>
                  {doc.summary && <p className="mt-3 text-[15px] text-muted-foreground max-w-2xl leading-relaxed">{doc.summary}</p>}
                </div>
                <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-widest print:hidden">
                  <div className="inline-flex rounded-md border border-hairline overflow-hidden">
                    <button onClick={() => switchLocale("en")} className={`px-2.5 py-1.5 ${locale === "en" ? "bg-panel-elevated text-foreground" : "text-muted-foreground hover:text-foreground"}`}>EN</button>
                    <button onClick={() => switchLocale("ar")} className={`px-2.5 py-1.5 border-l border-hairline ${locale === "ar" ? "bg-panel-elevated text-foreground" : "text-muted-foreground hover:text-foreground"}`}>العربية</button>
                  </div>
                  <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-hairline hover:bg-panel transition-colors" title={rtl ? "طباعة" : "Print / PDF"}>
                    <Printer className="size-3" /> {rtl ? "طباعة" : "Print"}
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="px-2.5 py-1 rounded-md bg-panel-elevated border border-hairline">v{doc.version}</span>
                {doc.effective_date && <span className="px-2.5 py-1 rounded-md bg-panel-elevated border border-hairline">{rtl ? "ساري من" : "Effective"} {doc.effective_date}</span>}
                <span className="px-2.5 py-1 rounded-md bg-panel-elevated border border-hairline">{rtl ? "آخر تحديث" : "Updated"} {new Date(doc.updated_at).toISOString().slice(0,10)}</span>
                <span className="px-2.5 py-1 rounded-md bg-panel-elevated border border-hairline inline-flex items-center gap-1"><Languages className="size-3" /> {locale === doc.locale ? locale.toUpperCase() : `${locale.toUpperCase()} → ${doc.locale.toUpperCase()} (fallback)`}</span>
              </div>

              <div className="signal-bar mt-8 mb-8" />

              <div ref={articleRef} className="max-w-3xl">
                <LegalRenderer markdown={doc.body_md} />
              </div>

              {/* Related documents on /Privacy/Home */}
              {doc.slug === "privacy-home" && (
                <div className="mt-12 rounded-xl border border-hairline bg-panel/50 p-5">
                  <div className="brand-eyebrow text-teal">{rtl ? "وثائق ذات صلة" : "Related documents"}</div>
                  <div className="mt-3 grid sm:grid-cols-3 gap-2">
                    {NAV.filter((n) => n.key !== "privacy-home").map((n) => {
                      const I = n.icon;
                      return (
                        <Link key={n.to} to={n.to} search={{ locale } as any}
                          onClick={() => trackNavClick({ event_name: "privacy_related_click", target_path: n.to, surface: "inline", locale })}
                          className="flex items-center gap-2 rounded-lg border border-hairline px-3 py-2.5 hover:bg-panel-elevated transition-colors text-[13px]">
                          <I className="size-3.5 text-teal" /> {rtl ? n.labelAr : n.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="instrument-panel p-10 text-center">
              <div className="brand-eyebrow" style={{ color: "var(--color-caution)" }}>{rtl ? "الوثيقة غير متاحة" : "Document unavailable"}</div>
              <h1 className="text-2xl font-bold mt-2">{rtl ? "لم تُنشر هذه الوثيقة بعد" : "This legal document hasn't been published yet"}</h1>
              <p className="text-sm text-muted-foreground mt-2">{rtl ? "يرجى المراجعة لاحقاً أو التواصل عبر" : "Please check back shortly or contact"} <a className="text-teal underline" href="mailto:privacy@velomedos.com">privacy@velomedos.com</a>.</p>
            </div>
          )}
        </article>
        </div>

        {/* Acceptance bar (Privacy + Terms only) */}
        {showAcceptBar && (
          <div className="fixed bottom-3 inset-x-3 lg:inset-x-auto lg:right-6 lg:left-auto lg:max-w-md z-40 print:hidden">
            <div className="instrument-panel p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.35)] flex items-start gap-3">
              <ShieldCheck className="size-4 text-teal mt-0.5 shrink-0" />
              <div className="text-[12.5px] leading-snug">
                {rtl
                  ? <>تم تحديث وثيقتنا (الإصدار v{doc!.version}{doc!.effective_date ? `، ساري من ${doc!.effective_date}` : ""}).</>
                  : <>We've updated our document (v{doc!.version}{doc!.effective_date ? `, effective ${doc!.effective_date}` : ""}).</>}
              </div>
              <button onClick={acknowledge} className="ms-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md mono text-[11px] uppercase tracking-widest font-semibold text-background" style={{ background: "var(--gradient-brand)" }}>
                <Check className="size-3" /> {rtl ? "تأكيد" : "Acknowledge"}
              </button>
            </div>
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}