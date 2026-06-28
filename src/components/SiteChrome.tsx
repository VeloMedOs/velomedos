import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SITE } from "@/lib/site-config";
import { BrandMark, BrandWordmark } from "@/components/BrandMark";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-background/80 backdrop-blur-xl">
      <div className="h-14 flex items-center justify-between px-4 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="relative">
            <BrandMark className="size-7 relative z-10" />
            <span aria-hidden className="absolute inset-0 rounded-full blur-md opacity-0 group-hover:opacity-60 transition-opacity duration-500" style={{ background: "var(--gradient-brand)" }} />
          </span>
          <BrandWordmark />
        </Link>
        <nav className="hidden md:flex items-center gap-1 mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {[
            ["Platform","/platform"],
            ["Solutions","/services"],
            ["Pricing","/pricing"],
            ["About","/about"],
            ["Privacy","/Privacy/Home"],
          ].map(([label, to]) => (
            <Link
              key={to}
              to={to}
              className="relative px-3 py-2 hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground [&_span.indicator]:opacity-100" }}
            >
              {label}
              <span aria-hidden className="indicator absolute left-3 right-3 -bottom-px h-px opacity-0 transition-opacity" style={{ background: "var(--gradient-brand)" }} />
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth" className="mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-md border border-hairline hover:bg-panel transition-colors">Sign in</Link>
          <Link
            to="/demo"
            className="mono text-[11px] uppercase tracking-widest px-3.5 py-1.5 rounded-md inline-flex items-center gap-1.5 font-semibold text-background relative overflow-hidden group"
            style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-glow-teal)" }}
          >
            <span className="relative z-10">Book a demo</span>
            <ArrowRight className="size-3 relative z-10" />
            <span aria-hidden className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: "linear-gradient(135deg, oklch(1 0 0 / 0.12), transparent)" }} />
          </Link>
        </div>
      </div>
      <div className="signal-bar" />
    </header>
  );
}

// VeloMed OS is a B2B platform for multi-branch operators — no patient-facing
// emergency disclaimer. Kept as a no-op for callers; will be removed entirely.
export function EmergencyBanner() { return null; }

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-panel/30 relative">
      <div className="signal-bar absolute top-0 left-0 right-0" />
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-14 grid md:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <BrandMark className="size-7" />
            <BrandWordmark />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[28ch]">The branch-aware operating system for multi-branch medical mobility operators. From your whole network down to one crew.</p>
          <div className="mt-5 inline-flex items-center gap-2 mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground px-2.5 py-1 rounded-full border border-hairline bg-background/40">
            <span className="vital-dot" /> All systems · operational
          </div>
        </div>
        <FooterCol title="Platform" links={[
          ["Network → Region → Team", "/platform"],
          ["Cases & dispatch","/services/emergency-dispatch"],
          ["Fleet & maintenance","/services/fleet-compliance"],
          ["Licensing & certification","/services/training-certification"],
          ["Remote clinics","/services/remote-clinics"],
          ["Mobile screening","/services/mobile-screening"],
        ]} />
        <FooterCol title="Resources" links={[
          ["Insights & guides","/resources"],
          ["Service catalogue","/services"],
          ["Clinic network","/clinics"],
          ["Website map","/website"],
        ]} />
        <FooterCol title="Company" links={[
          ["About","/about"],
          ["Pricing","/pricing"],
          ["Book a demo","/demo"],
          ["Business onboarding","/business-intake"],
          ["Talk to us","/contact"],
          ["Sign in","/auth"],
        ]} />
      </div>
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 pb-10 grid md:grid-cols-4 gap-10">
        <div className="md:col-start-4">
          <FooterCol title="Privacy & Legal" links={[
            ["Privacy Notice", "/Privacy/Home"],
            ["Terms of Service", "/Privacy/TermsOfService"],
            ["HIPAA-Aligned Safeguards", "/Privacy/HIPAA"],
            ["Patient Rights", "/Privacy/PatientRights"],
          ]} />
        </div>
      </div>
      <div className="border-t border-hairline">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-4 mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} {SITE.legal} · Built for mission-critical care</span>
          <span className="flex items-center gap-3">
            <span className="hidden sm:inline">KSA PDPL · GCC · HIPAA · NCA ECC-1</span>
            <span className="flex items-center gap-1.5"><span className="vital-dot" /> Network nominal</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <div className="brand-eyebrow text-muted-foreground mb-3" style={{ color: "var(--color-muted-foreground)" }}>{title}</div>
      <ul className="space-y-2">
        {links.map(([label, to]) => (
          <li key={to+label}><Link to={to} className="text-sm text-foreground/75 hover:text-teal transition-colors">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}