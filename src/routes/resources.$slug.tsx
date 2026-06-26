import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";
import { getResource, RESOURCES, SITE } from "@/lib/site-config";
import { breadcrumbLd, jsonld } from "@/components/Jsonld";
import { ArrowRight, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/resources/$slug")({
  loader: ({ params }) => {
    const r = getResource(params.slug);
    if (!r) throw notFound();
    return { article: r };
  },
  head: ({ loaderData, params }) => {
    const r = loaderData?.article;
    if (!r) return {};
    const title = `${r.title} — ${SITE.brand}`.slice(0, 65);
    const desc = r.description.slice(0, 158);
    const url = `/resources/${params.slug}`;
    return {
      meta: [
        { title }, { name: "description", content: desc },
        { property: "og:title", content: r.title }, { property: "og:description", content: desc },
        { property: "og:url", content: url }, { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "index,follow" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        { type: "application/ld+json", children: jsonld({
          "@context": "https://schema.org", "@type": "BlogPosting",
          headline: r.title, description: r.description, datePublished: r.date,
          author: { "@type": "Organization", name: SITE.legal },
          publisher: { "@type": "Organization", name: SITE.legal },
          url,
        }) },
        { type: "application/ld+json", children: jsonld(breadcrumbLd([
          { name: "Home", href: "/" },
          { name: "Resources", href: "/resources" },
          { name: r.title, href: url },
        ])) },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-background text-foreground"><SiteHeader />
      <div className="max-w-2xl mx-auto p-16 text-center">
        <h1 className="text-3xl font-bold">Article not found</h1>
        <Link to="/resources" className="text-action mono text-[11px] uppercase tracking-widest mt-4 inline-block">All articles →</Link>
      </div>
    </div>
  ),
  component: Article,
});

function Article() {
  const { article: r } = Route.useLoaderData();
  const others = RESOURCES.filter((o) => o.slug !== r.slug).slice(0, 2);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <EmergencyBanner />
      <nav aria-label="Breadcrumb" className="max-w-[800px] mx-auto px-4 lg:px-8 pt-6 mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
        <Link to="/" className="hover:text-foreground">Home</Link><ChevronRight className="size-3" />
        <Link to="/resources" className="hover:text-foreground">Resources</Link><ChevronRight className="size-3" />
        <span className="text-foreground truncate">{r.title}</span>
      </nav>
      <article className="max-w-[800px] mx-auto px-4 lg:px-8 pt-8 pb-16">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{new Date(r.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} · {r.readMinutes} min read</div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mt-3">{r.title}</h1>
        <p className="text-lg text-muted-foreground mt-4 leading-relaxed">{r.excerpt}</p>
        <div className="mt-8 space-y-5">
          {r.body.map((p: string, i: number) => (
            <p key={i} className="text-base leading-[1.75] text-foreground/90">{p}</p>
          ))}
        </div>
      </article>
      <section className="max-w-[800px] mx-auto px-4 lg:px-8 pb-16">
        <div className="rounded-xl border border-hairline bg-panel p-6 text-center">
          <h2 className="text-xl font-semibold">Run medical mobility on a single API.</h2>
          <p className="text-sm text-muted-foreground mt-2">Talk to our team about replacing dashboards with controls.</p>
          <Link to="/demo" className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-emergency text-emergency-foreground mono text-[11px] uppercase tracking-widest font-bold">Request a demo <ArrowRight className="size-3.5" /></Link>
        </div>
      </section>
      {others.length > 0 && (
        <section className="max-w-[1100px] mx-auto px-4 lg:px-8 pb-20 border-t border-hairline pt-12">
          <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Keep reading</div>
          <div className="grid md:grid-cols-2 gap-4">
            {others.map((o) => (
              <Link key={o.slug} to="/resources/$slug" params={{ slug: o.slug }} className="rounded-lg border border-hairline bg-panel p-5 hover:bg-panel-elevated transition-colors">
                <div className="text-sm font-semibold">{o.title}</div>
                <p className="text-xs text-muted-foreground mt-1.5">{o.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
      <SiteFooter />
    </div>
  );
}