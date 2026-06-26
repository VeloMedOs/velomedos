import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";
import { ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";
import { getService, SERVICES, SITE } from "@/lib/site-config";
import { breadcrumbLd, faqLd, jsonld } from "@/components/Jsonld";

export const Route = createFileRoute("/services/$slug")({
  loader: ({ params }) => {
    const service = getService(params.slug);
    if (!service) throw notFound();
    return { service };
  },
  head: ({ loaderData, params }) => {
    const s = loaderData?.service;
    if (!s) return {};
    const title = `${s.title} — ${SITE.brand}`.slice(0, 65);
    const desc = s.short.slice(0, 158);
    const url = `/services/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: s.title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: s.title },
        { name: "twitter:description", content: desc },
        { name: "robots", content: "index,follow" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        { type: "application/ld+json", children: jsonld({
          "@context": "https://schema.org", "@type": "Service",
          name: s.title, description: s.short, serviceType: s.keyword,
          provider: { "@type": "MedicalBusiness", name: SITE.brand },
          areaServed: SITE.cities.map((c) => ({ "@type": "City", name: c.name })),
          url,
        }) },
        { type: "application/ld+json", children: jsonld(faqLd(s.faqs)) },
        { type: "application/ld+json", children: jsonld(breadcrumbLd([
          { name: "Home", href: "/" },
          { name: "Services", href: "/services" },
          { name: s.title, href: url },
        ])) },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-background text-foreground"><SiteHeader />
      <div className="max-w-2xl mx-auto p-16 text-center">
        <h1 className="text-3xl font-bold">Service not found</h1>
        <Link to="/services" className="text-action mono text-[11px] uppercase tracking-widest mt-4 inline-block">All services →</Link>
      </div>
    </div>
  ),
  component: ServicePage,
});

function ServicePage() {
  const { service: s } = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <EmergencyBanner />
      <nav aria-label="Breadcrumb" className="max-w-[1100px] mx-auto px-4 lg:px-8 pt-6 mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
        <Link to="/" className="hover:text-foreground">Home</Link><ChevronRight className="size-3" />
        <Link to="/services" className="hover:text-foreground">Services</Link><ChevronRight className="size-3" />
        <span className="text-foreground truncate">{s.title}</span>
      </nav>
      <header className="max-w-[1100px] mx-auto px-4 lg:px-8 pt-8 pb-10">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-action mb-2">VeloMed Service</div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight max-w-3xl">{s.title}</h1>
        <p className="text-lg text-muted-foreground mt-4 max-w-2xl leading-relaxed">{s.short}</p>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link to="/contact" className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-emergency text-emergency-foreground mono text-xs uppercase tracking-widest font-bold hover:bg-emergency/90">Request a demo <ArrowRight className="size-3.5" /></Link>
          <Link to="/api-docs" className="inline-flex items-center gap-2 px-5 py-3 rounded-md border border-hairline mono text-xs uppercase tracking-widest hover:bg-panel">Read the API <ArrowRight className="size-3.5" /></Link>
        </div>
      </header>
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 py-12 grid lg:grid-cols-2 gap-10">
        <div>
          <h2 className="text-xl font-semibold mb-4">What you get</h2>
          <ul className="space-y-3">{s.benefits.map((b: string) => (
            <li key={b} className="flex gap-3 text-sm leading-relaxed"><CheckCircle2 className="size-4 text-stable shrink-0 mt-0.5" /><span>{b}</span></li>
          ))}</ul>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-4">How it works</h2>
          <ol className="space-y-3">{s.how.map((h: string, i: number) => (
            <li key={h} className="flex gap-3 text-sm leading-relaxed"><span className="mono text-[10px] text-action border border-action/40 rounded h-5 w-5 grid place-items-center shrink-0 mt-0.5">{i+1}</span><span>{h}</span></li>
          ))}</ol>
        </div>
      </section>
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 py-12">
        <h2 className="text-xl font-semibold mb-4">Frequently asked questions</h2>
        <div className="divide-y divide-hairline border border-hairline rounded-xl bg-panel">
          {s.faqs.map((f: { q: string; a: string }) => (
            <details key={f.q} className="group p-5">
              <summary className="cursor-pointer text-sm font-medium flex items-center justify-between">{f.q}<ChevronRight className="size-4 transition-transform group-open:rotate-90" /></summary>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 py-16 border-t border-hairline">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Other services</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SERVICES.filter((o) => o.slug !== s.slug).map((o) => (
            <Link key={o.slug} to="/services/$slug" params={{ slug: o.slug }} className="rounded-lg border border-hairline bg-panel p-4 hover:bg-panel-elevated transition-colors">
              <div className="text-sm font-semibold">{o.title}</div>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.short}</div>
            </Link>
          ))}
        </div>
      </section>
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Ready to run this in production?</h2>
        <p className="text-muted-foreground mt-3">Talk to our team — we'll scope it against your fleet and cities.</p>
        <Link to="/contact" className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-md bg-emergency text-emergency-foreground mono text-xs uppercase tracking-widest font-bold">Request a demo <ArrowRight className="size-3.5" /></Link>
      </section>
      <SiteFooter />
    </div>
  );
}