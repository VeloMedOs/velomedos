import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";
import { RESOURCES, SITE } from "@/lib/site-config";
import { ArrowRight, BookOpen } from "lucide-react";
import { breadcrumbLd, jsonld, pageLdScripts } from "@/components/Jsonld";

const title = "Resources & insights — VeloMed OS";
const desc = "Operating notes on ambulance dispatch SLAs, fleet compliance and medical mobility from the VeloMed Infrastructure team.";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:url", content: "/resources" }, { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" }, { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/resources" }],
    scripts: [
      { type: "application/ld+json", children: jsonld({
        "@context": "https://schema.org", "@type": "Blog",
        name: `${SITE.brand} Resources`, url: "/resources",
        blogPost: RESOURCES.map((r) => ({ "@type": "BlogPosting", headline: r.title, url: `/resources/${r.slug}`, datePublished: r.date })),
      }) },
      { type: "application/ld+json", children: jsonld(breadcrumbLd([
        { name: "Home", href: "/" }, { name: "Resources", href: "/resources" },
      ])) },
      ...pageLdScripts({ path: "/resources", name: title, description: desc, type: "CollectionPage" }),
    ],
  }),
  component: Resources,
});

function Resources() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <EmergencyBanner />
      <header className="max-w-[1100px] mx-auto px-4 lg:px-8 pt-16 pb-10">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">Resources</div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">Operating notes from the VeloMed team.</h1>
        <p className="text-muted-foreground mt-4 max-w-2xl text-lg">Field-tested writing on ambulance dispatch, fleet compliance, telehealth and medical mobility.</p>
      </header>
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 -mt-2 mb-8">
        <Link to="/resources/comparison" className="block rounded-xl border border-action/30 bg-panel p-5 hover:bg-panel-elevated transition-colors">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-action">Featured · Buyer's guide</div>
              <div className="text-lg font-semibold mt-1">Ambulance dispatch software: VeloMed OS vs ESO Suite</div>
              <div className="text-sm text-muted-foreground mt-1">Branch-aware Network → Region → Crew drill-down vs a legacy single-agency suite.</div>
            </div>
            <span className="mono text-[10px] uppercase tracking-widest text-action inline-flex items-center gap-1">Open guide <ArrowRight className="size-3" /></span>
          </div>
        </Link>
      </section>
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 pb-24 grid md:grid-cols-2 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline">
        {RESOURCES.map((r) => (
          <Link key={r.slug} to="/resources/$slug" params={{ slug: r.slug }} className="bg-panel p-6 hover:bg-panel-elevated transition-colors">
            <BookOpen className="size-5 text-action mb-4" />
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{new Date(r.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })} · {r.readMinutes} min read</div>
            <h2 className="text-xl font-semibold mt-2 leading-snug">{r.title}</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{r.excerpt}</p>
            <div className="mono text-[10px] text-action uppercase tracking-widest mt-4 inline-flex items-center gap-1">Read article <ArrowRight className="size-3" /></div>
          </Link>
        ))}
      </section>
      <SiteFooter />
    </div>
  );
}