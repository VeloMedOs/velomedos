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
      <div className="max-w-[1100px] mx-auto px-4 lg:px-8 py-12 grid lg:grid-cols-[240px_minmax(0,1fr)] gap-10">
        <aside className="lg:sticky lg:top-24 self-start">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal mb-3">Legal Center</div>
          <nav className="flex lg:flex-col gap-1 overflow-x-auto">
            {NAV.map((n) => {
              const active = n.key === activeKey;
              const Icon = n.icon;
              return (
                <Link key={n.to} to={n.to} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] whitespace-nowrap transition-colors ${active ? "bg-teal/10 text-foreground border border-teal/30" : "text-muted-foreground hover:text-foreground hover:bg-panel-elevated border border-transparent"}`}>
                  <Icon className={`size-3.5 ${active ? "text-teal" : ""}`} />
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 rounded-lg border border-hairline bg-panel p-3 hidden lg:block">
            <div className="mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">Compliance</div>
            <div className="text-[11px] text-foreground/80 mt-1.5 leading-5">
              KSA PDPL · GCC data laws · HIPAA (Business Associate) · CHI · NCA ECC-1
            </div>
          </div>
        </aside>
        <article className="min-w-0">
          {doc ? (
            <>
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">VeloMed OS · Legal</div>
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mt-1">{doc.title}</h1>
              {doc.subtitle && <p className="mt-2 text-[14px] text-muted-foreground max-w-2xl">{doc.subtitle}</p>}
              <div className="mt-3 flex flex-wrap gap-2 mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="px-2 py-1 rounded bg-panel-elevated border border-hairline">v{doc.version}</span>
                {doc.effective_date && <span className="px-2 py-1 rounded bg-panel-elevated border border-hairline">Effective {doc.effective_date}</span>}
                <span className="px-2 py-1 rounded bg-panel-elevated border border-hairline">Updated {new Date(doc.updated_at).toISOString().slice(0,10)}</span>
              </div>
              <div className="mt-8 max-w-3xl">
                <LegalRenderer markdown={doc.body_md} />
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-hairline bg-panel p-8 text-center">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-caution">Document unavailable</div>
              <h1 className="text-2xl font-bold mt-2">This legal document hasn't been published yet</h1>
              <p className="text-sm text-muted-foreground mt-2">Please check back shortly or contact <a className="text-teal underline" href="mailto:privacy@velomedos.com">privacy@velomedos.com</a>.</p>
            </div>
          )}
        </article>
      </div>
      <SiteFooter />
    </div>
  );
}