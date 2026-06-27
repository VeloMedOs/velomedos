import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SITE } from "@/lib/site-config";
import { BrandMark, BrandWordmark } from "@/components/BrandMark";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 h-14 border-b border-hairline bg-background/85 backdrop-blur flex items-center justify-between px-4 lg:px-8">
      <Link to="/" className="flex items-center gap-2">
        <BrandMark className="size-7" />
        <BrandWordmark />
      </Link>
      <nav className="hidden md:flex items-center gap-6 mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        <Link to="/platform" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Platform</Link>
        <Link to="/services" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Solutions</Link>
        <Link to="/pricing" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Pricing</Link>
        <Link to="/about" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>About</Link>
      </nav>
      <div className="flex items-center gap-2">
        <Link to="/auth" className="mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-md border border-hairline hover:bg-panel">Sign in</Link>
        <Link to="/demo" className="mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-md bg-teal text-background hover:bg-teal/90 inline-flex items-center gap-1.5 font-semibold">Book a demo <ArrowRight className="size-3" /></Link>
      </div>
    </header>
  );
}

// VeloMed OS is a B2B platform for multi-branch operators — no patient-facing
// emergency disclaimer. Kept as a no-op for callers; will be removed entirely.
export function EmergencyBanner() { return null; }

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-panel/30">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-12 grid md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BrandMark className="size-7" />
            <BrandWordmark />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">The branch-aware operating system for multi-branch medical mobility operators. From your whole network down to one crew.</p>
        </div>
        <FooterCol title="Platform" links={[
          ["Network → Region → Team", "/platform"],
          ["Cases & dispatch","/services/emergency-dispatch"],
          ["Fleet & maintenance","/services/fleet-compliance"],
          ["Licensing & certification","/services/training-certification"],
          ["Remote clinics","/services/remote-clinics"],
          ["Mobile screening","/services/mobile-screening"],
        ]} />
        <FooterCol title="Developer" links={[
          ["API overview","/developers"],
          ["API reference","/api-reference"],
          ["OpenAPI / Swagger","/api-docs"],
          ["Resources","/resources"],
          ["Website map","/website"],
        ]} />
        <FooterCol title="Company" links={[
          ["About","/about"],
          ["Pricing","/pricing"],
          ["Book a demo","/demo"],
          ["Talk to us","/contact"],
          ["Sign in","/auth"],
          ["Privacy","/privacy"],
          ["Terms","/terms"],
        ]} />
      </div>
      <div className="border-t border-hairline">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-4 mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} {SITE.legal} · All core systems operational</span>
          <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-teal animate-pulse" /> Network · operational</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">{title}</div>
      <ul className="space-y-2">
        {links.map(([label, to]) => (
          <li key={to+label}><Link to={to} className="text-sm hover:text-action">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}