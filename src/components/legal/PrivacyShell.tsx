import { Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { LegalRenderer } from "./LegalRenderer";
import { ShieldCheck, FileText, HeartPulse, UserCheck } from "lucide-react";
import type { LegalDoc } from "@/lib/legal.functions";

const NAV: { to: string; label: string; icon: any; key: string }[] = [
  { to: "/Privacy/Home",            label: "Privacy",         icon: ShieldCheck, key: "home" },
  { to: "/Privacy/TermsOfService",  label: "Terms of Service", icon: FileText,    key: "terms" },
  { to: "/Privacy/HIPAA",           label: "HIPAA Notice",     icon: HeartPulse,  key: "hipaa" },
  { to: "/Privacy/PatientRights",   label: "Patient Rights",   icon: UserCheck,   key: "patient-rights" },
];

export function PrivacyShell({ doc, activeKey }: { doc: LegalDoc | null; activeKey: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="relative">
        <div aria-hidden className="absolute inset-x-0 top-0 h-[420px] brand-wash pointer-events-none" />
        <div className="relative max-w-[1100px] mx-auto px-4 lg:px-8 py-14 grid lg:grid-cols-[240px_minmax(0,1fr)] gap-12">
        <aside className="lg:sticky lg:top-24 self-start">
          <div className="brand-eyebrow mb-4"><span className="vital-dot" /> Legal Center</div>
          <nav className="flex lg:flex-col gap-1 overflow-x-auto">
            {NAV.map((n) => {
              const active = n.key === activeKey;
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
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
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 rounded-lg border border-hairline bg-panel/70 p-3.5 hidden lg:block relative overflow-hidden">
            <div aria-hidden className="absolute -top-12 -right-12 size-32 rounded-full opacity-[0.08] blur-2xl" style={{ background: "var(--gradient-brand)" }} />
            <div className="brand-eyebrow text-muted-foreground" style={{ color: "var(--color-muted-foreground)" }}>Compliance</div>
            <div className="text-[11px] text-foreground/85 mt-1.5 leading-5 relative">
              KSA PDPL · GCC data laws · HIPAA (Business Associate) · CHI · NCA ECC-1
            </div>
          </div>
        </aside>
        <article className="min-w-0">
          {doc ? (
            <>
              <div className="brand-eyebrow text-muted-foreground" style={{ color: "var(--color-muted-foreground)" }}>VeloMed OS · Legal</div>
              <h1 className="font-serif text-4xl lg:text-5xl tracking-tight mt-2 leading-[1.05]">{doc.title}</h1>
              {doc.subtitle && <p className="mt-3 text-[15px] text-muted-foreground max-w-2xl leading-relaxed">{doc.subtitle}</p>}
              <div className="mt-5 flex flex-wrap gap-2 mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="px-2.5 py-1 rounded-md bg-panel-elevated border border-hairline">v{doc.version}</span>
                {doc.effective_date && <span className="px-2.5 py-1 rounded-md bg-panel-elevated border border-hairline">Effective {doc.effective_date}</span>}
                <span className="px-2.5 py-1 rounded-md bg-panel-elevated border border-hairline">Updated {new Date(doc.updated_at).toISOString().slice(0,10)}</span>
              </div>
              <div className="signal-bar mt-8 mb-8" />
              <div className="max-w-3xl">
                <LegalRenderer markdown={doc.body_md} />
              </div>
            </>
          ) : (
            <div className="instrument-panel p-10 text-center">
              <div className="brand-eyebrow" style={{ color: "var(--color-caution)" }}>Document unavailable</div>
              <h1 className="text-2xl font-bold mt-2">This legal document hasn't been published yet</h1>
              <p className="text-sm text-muted-foreground mt-2">Please check back shortly or contact <a className="text-teal underline" href="mailto:privacy@velomedos.com">privacy@velomedos.com</a>.</p>
            </div>
          )}
        </article>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}