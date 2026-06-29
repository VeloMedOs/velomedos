import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";
import { ArrowRight, ChevronRight } from "lucide-react";
import { SITE } from "@/lib/site-config";
import { getServicePage, SERVICE_PAGES, accentClasses } from "@/content/services";
import { breadcrumbLd, jsonld } from "@/components/Jsonld";

export const Route = createFileRoute("/services/$slug")({
  loader: ({ params }) => {
    const service = getServicePage(params.slug);
    if (!service) throw notFound();
    return { service };
  },
  head: ({ loaderData, params }) => {
    const s = loaderData?.service;
    if (!s) return {};
    const title = s.seo.title;
    const desc = s.seo.description;
    const url = `https://velomedos.com/services/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "robots", content: "index,follow" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        { type: "application/ld+json", children: jsonld({
          "@context": "https://schema.org", "@type": "Service",
          name: s.title, description: s.subtitle, serviceType: s.eyebrow,
          provider: { "@type": "MedicalBusiness", name: SITE.brand },
          areaServed: SITE.cities.map((c) => ({ "@type": "City", name: c.name })),
          url,
        }) },
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
  const a = accentClasses(s.accent);
  const Icon = s.icon;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <EmergencyBanner />
      <nav aria-label="Breadcrumb" className="max-w-5xl mx-auto px-4 lg:px-8 pt-6 mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
        <Link to="/" className="hover:text-foreground">Home</Link><ChevronRight className="size-3" />
        <Link to="/services" className="hover:text-foreground">Solutions</Link><ChevronRight className="size-3" />
        <span className="text-foreground truncate">{s.title}</span>
      </nav>

      {/* Hero */}
      <header className="max-w-5xl mx-auto px-4 lg:px-8 pt-10 pb-14">
        <div className="flex items-center gap-3 mb-4">
          <span className={`grid place-items-center size-10 rounded-lg ${a.bgSoft} ring-1 ${a.ring}`}>
            <Icon className={`size-5 ${a.text}`} />
          </span>
          <div className={`mono text-[10px] uppercase tracking-[0.22em] ${a.text}`}>{s.eyebrow}</div>
        </div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight max-w-4xl leading-tight">{s.title}</h1>
        <p className="text-lg text-muted-foreground mt-5 max-w-3xl leading-relaxed">{s.subtitle}</p>
        <div className="flex flex-wrap gap-3 mt-7">
          <Link to={s.ctaPrimary.href} className={`inline-flex items-center gap-2 px-5 py-3 rounded-md mono text-xs uppercase tracking-widest font-bold ${a.btn}`}>{s.ctaPrimary.label} <ArrowRight className="size-3.5" /></Link>
          {s.ctaSecondary && (
            <Link to={s.ctaSecondary.href} className="inline-flex items-center gap-2 px-5 py-3 rounded-md border border-hairline mono text-xs uppercase tracking-widest hover:bg-panel">
              {s.ctaSecondary.label} <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
      </header>

      {/* Overview */}
      <section className="max-w-5xl mx-auto px-4 lg:px-8 py-10 border-t border-hairline">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Overview</div>
        <p className="text-lg leading-relaxed text-foreground/90 max-w-3xl">{s.overview}</p>
      </section>

      {/* Capabilities */}
      <section className="max-w-5xl mx-auto px-4 lg:px-8 py-12 border-t border-hairline">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-5">Capabilities</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {s.capabilities.map((c) => {
            const CIcon = c.icon;
            return (
              <div key={c.title} className="rounded-xl border border-hairline bg-panel p-5">
                <CIcon className={`size-5 ${a.text} mb-3`} />
                <div className="text-sm font-semibold">{c.title}</div>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{c.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 lg:px-8 py-12 border-t border-hairline">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-5">How it works</div>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {s.steps.map((step, i) => (
            <li key={step.title} className="rounded-lg border border-hairline bg-panel p-4 flex gap-3">
              <span className={`mono text-[10px] ${a.text} border ${a.border} rounded h-6 w-6 grid place-items-center shrink-0`}>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <div className="text-sm font-medium">{step.title}</div>
                {step.body && <p className="text-xs text-muted-foreground mt-1">{step.body}</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Who it's for */}
      <section className="max-w-5xl mx-auto px-4 lg:px-8 py-12 border-t border-hairline">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Who it's for</div>
        <div className="flex flex-wrap gap-2">
          {s.audiences.map((aud) => (
            <span key={aud} className="text-xs px-3 py-1.5 rounded-full border border-hairline bg-panel">{aud}</span>
          ))}
        </div>
      </section>

      {/* Outcomes */}
      <section className="max-w-5xl mx-auto px-4 lg:px-8 py-12 border-t border-hairline">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-5">Outcomes</div>
        <div className="grid sm:grid-cols-3 gap-4">
          {s.outcomes.map((o) => (
            <div key={o.label} className={`rounded-xl border ${a.border} ${a.bgSoft} p-5`}>
              {o.stat && <div className={`text-2xl font-bold ${a.text}`}>{o.stat}</div>}
              <div className="text-sm mt-1 leading-relaxed">{o.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Integrations */}
      <section className="max-w-5xl mx-auto px-4 lg:px-8 py-12 border-t border-hairline">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">What it connects to</div>
        <ul className="grid sm:grid-cols-2 gap-2">
          {s.integrations.map((i) => (
            <li key={i} className="text-sm flex gap-2 items-start">
              <span className={`mt-2 inline-block size-1.5 rounded-full ${a.bg}`} />
              <span>{i}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Related */}
      <section className="max-w-5xl mx-auto px-4 lg:px-8 py-12 border-t border-hairline">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Related services</div>
        <div className="grid sm:grid-cols-3 gap-3">
          {s.related.map((slug) => {
            const r = SERVICE_PAGES.find((p) => p.slug === slug);
            if (!r) return null;
            const RIcon = r.icon;
            const ra = accentClasses(r.accent);
            return (
              <Link key={slug} to="/services/$slug" params={{ slug }} className="rounded-lg border border-hairline bg-panel p-4 hover:bg-panel-elevated transition-colors">
                <RIcon className={`size-5 ${ra.text} mb-2`} />
                <div className="text-sm font-semibold leading-snug">{r.title}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.subtitle}</div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* CTA band */}
      <section className="max-w-5xl mx-auto px-4 lg:px-8 py-20 text-center border-t border-hairline">
        <h2 className="text-3xl font-bold tracking-tight">Ready to run this in production?</h2>
        <p className="text-muted-foreground mt-3">Talk to our team — we'll scope it against your fleet, branches and SLAs.</p>
        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          <Link to={s.ctaPrimary.href} className={`inline-flex items-center gap-2 px-6 py-3 rounded-md mono text-xs uppercase tracking-widest font-bold ${a.btn}`}>{s.ctaPrimary.label} <ArrowRight className="size-3.5" /></Link>
          <Link to="/services" className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-hairline mono text-xs uppercase tracking-widest hover:bg-panel">All solutions <ArrowRight className="size-3.5" /></Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}