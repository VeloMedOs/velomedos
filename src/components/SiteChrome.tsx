import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { SITE } from "@/lib/site-config";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 h-14 border-b border-hairline bg-background/85 backdrop-blur flex items-center justify-between px-4 lg:px-8">
      <Link to="/" className="flex items-center gap-2">
        <div className="size-7 rounded-md bg-emergency grid place-items-center text-emergency-foreground shadow-[0_0_18px_oklch(0.62_0.22_27/0.5)]">
          <Activity className="size-4" />
        </div>
        <span className="font-bold tracking-tight">VELOMED <span className="text-emergency">OS</span></span>
      </Link>
      <nav className="hidden md:flex items-center gap-6 mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        <Link to="/services" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Services</Link>
        <Link to="/clinics" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Clinics</Link>
        <Link to="/resources" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Resources</Link>
        <Link to="/pricing" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Pricing</Link>
        <Link to="/about" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>About</Link>
        <Link to="/developers" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Developers</Link>
        <Link to="/contact" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Contact</Link>
      </nav>
      <div className="flex items-center gap-2">
        <Link to="/auth" className="mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-md border border-hairline hover:bg-panel">Sign in</Link>
        <Link to="/demo" className="mono text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-md bg-emergency text-emergency-foreground hover:bg-emergency/90">Request a demo</Link>
      </div>
    </header>
  );
}

export function EmergencyBanner() {
  return (
    <div className="bg-emergency/10 border-b border-emergency/30 text-foreground">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-2.5 text-[12px] flex flex-wrap items-center justify-between gap-2">
        <span><strong className="text-emergency">Life-threatening?</strong> Call your local emergency number directly. This site is for dispatchable non-911 requests inside our operating regions.</span>
        <Link to="/contact" className="mono text-[10px] uppercase tracking-widest underline hover:text-emergency">Non-emergency request →</Link>
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-panel/30">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-12 grid md:grid-cols-5 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="size-7 rounded-md bg-emergency grid place-items-center text-emergency-foreground"><Activity className="size-4" /></div>
            <span className="font-bold">VELOMED <span className="text-emergency">OS</span></span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">Medical mobility infrastructure for dispatch, providers, patients, and partners — on one documented REST API.</p>
        </div>
        <FooterCol title="Services" links={[
          ["Emergency dispatch","/services/emergency-dispatch"],
          ["Fleet compliance","/services/fleet-compliance"],
          ["Remote clinics","/services/remote-clinics"],
          ["Mobile screening","/services/mobile-screening"],
          ["Training","/services/training-certification"],
          ["Developer API","/services/developer-api"],
        ]} />
        <FooterCol title="Cities served" links={SITE.cities.map((c) => [c.name, `/clinics/${c.slug}`])} />
        <FooterCol title="Platform" links={[["Resources","/resources"],["Pricing","/pricing"],["About","/about"],["Developers","/developers"],["API reference","/api-reference"],["API Docs","/api-docs"],["Website map","/website"]]} />
        <FooterCol title="Get in touch" links={[["Request a demo","/demo"],["Request help","/contact"],["Sign in","/auth"],["Privacy","/privacy"],["Terms","/terms"]]} />
      </div>
      <div className="border-t border-hairline">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-4 mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} {SITE.legal} · All core systems operational</span>
          <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-stable animate-pulse" /> API v1.2</span>
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