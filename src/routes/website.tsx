import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";
import { SITE, SERVICES, RESOURCES } from "@/lib/site-config";
import { breadcrumbLd, jsonld } from "@/components/Jsonld";
import { ArrowRight, Globe } from "lucide-react";

const title = "Browse the VeloMed OS website — full site map";
const desc = "One page to browse every public surface of VeloMed OS: services, clinics by city, resources, developer tools, pricing, legal and contact.";

export const Route = createFileRoute("/website")({
  head: () => ({
    meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:url", content: "/website" }, { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" }, { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/website" }],
    scripts: [
      { type: "application/ld+json", children: jsonld(breadcrumbLd([
        { name: "Home", href: "/" }, { name: "Website map", href: "/website" },
      ])) },
    ],
  }),
  component: WebsiteIndex,
});

type Entry = { label: string; to: string; desc?: string };

function Section({ title, entries }: { title: string; entries: Entry[] }) {
  return (
    <div>
      <div className="mono text-[10px] uppercase tracking-[0.22em] text-action mb-3">{title}</div>
      <ul className="space-y-px bg-hairline rounded-lg overflow-hidden border border-hairline">
        {entries.map((e) => (
          <li key={e.to}>
            <Link to={e.to} className="group flex items-start justify-between gap-4 bg-panel hover:bg-panel-elevated px-4 py-3 transition">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{e.label}</div>
                {e.desc && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{e.desc}</div>}
                <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{e.to}</div>
              </div>
              <ArrowRight className="size-4 text-muted-foreground group-hover:text-action shrink-0 mt-1" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WebsiteIndex() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <EmergencyBanner />
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 pt-16 pb-8">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-action mb-2 flex items-center gap-2"><Globe className="size-3" /> Website map</div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">Browse VeloMed OS</h1>
        <p className="text-muted-foreground mt-4 max-w-2xl text-lg">A single index of every public page — marketing, services, city directories, developer surface and legal.</p>
      </section>

      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 pb-20 grid md:grid-cols-2 gap-10">
        <Section title="Core pages" entries={[
          { label: "Home", to: "/", desc: "Landing page with hero, services and trust signals." },
          { label: "About", to: "/about", desc: "Company, mission and operating regions." },
          { label: "Pricing", to: "/pricing", desc: "Plans and what's included." },
          { label: "Contact", to: "/contact", desc: "Branching intake: emergency, clinic, screening, lead." },
          { label: "Request a demo", to: "/demo", desc: "Sales-qualified demo intake for operators." },
        ]} />
        <Section title="Services" entries={SERVICES.map((s) => ({
          label: s.title, to: `/services/${s.slug}`, desc: s.short,
        }))} />
        <Section title={`Clinics across ${SITE.region}`} entries={[
          { label: "All clinics", to: "/clinics", desc: "Directory of physical, mobile and telehealth clinics." },
          ...SITE.cities.map((c) => ({ label: `${c.name}, ${c.country}`, to: `/clinics/${c.slug}` })),
        ]} />
        <Section title="Resources" entries={[
          { label: "All articles", to: "/resources", desc: "Operator-grade writing on medical mobility." },
          ...RESOURCES.map((r) => ({ label: r.title, to: `/resources/${r.slug}`, desc: r.excerpt })),
        ]} />
        <Section title="Developer surface" entries={[
          { label: "Developers overview", to: "/developers", desc: "API-first platform pitch and quickstart." },
          { label: "API reference (try it)", to: "/api-reference", desc: "Live example endpoints with request/response playground." },
          { label: "Swagger UI", to: "/api-docs", desc: "Full OpenAPI 3.1 reference, rendered live." },
        ]} />
        <Section title="Account & legal" entries={[
          { label: "Sign in", to: "/auth", desc: "Operator, provider and patient sign-in." },
          { label: "Privacy", to: "/privacy" },
          { label: "Terms", to: "/terms" },
          { label: "Sitemap.xml", to: "/sitemap.xml", desc: "Machine-readable sitemap for crawlers." },
        ]} />
      </section>

      <SiteFooter />
    </div>
  );
}