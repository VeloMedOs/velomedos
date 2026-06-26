import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { breadcrumbLd, jsonld } from "@/components/Jsonld";

const title = "Pricing & plans — VeloMed OS";
const desc = "Transparent pricing for ambulance dispatch, telehealth, mobile screening and the public REST API. Talk to us for a scoped quote.";

const PLANS = [
  { name: "Operator", price: "Custom", target: "Single-city fleets", features: ["Dispatch console", "Provider & patient apps", "Fleet compliance", "Up to 25 ambulances", "Email support"] },
  { name: "Network", price: "Custom", target: "Multi-city operators", features: ["Everything in Operator", "Multi-tenant", "Telehealth + screening", "Up to 200 ambulances", "Priority response"] },
  { name: "Platform", price: "Custom", target: "Regional & sovereign", features: ["Everything in Network", "Dedicated cluster", "Custom SLAs", "Unlimited units", "24/7 named support"] },
];

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:url", content: "/pricing" }, { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" }, { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
    scripts: [{ type: "application/ld+json", children: jsonld(breadcrumbLd([
      { name: "Home", href: "/" }, { name: "Pricing", href: "/pricing" },
    ])) }],
  }),
  component: Pricing,
});

function Pricing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <EmergencyBanner />
      <header className="max-w-[1100px] mx-auto px-4 lg:px-8 pt-16 pb-10 text-center">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">Pricing</div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">Priced against your fleet, not seats.</h1>
        <p className="text-muted-foreground mt-4 max-w-xl mx-auto text-lg">Every plan includes dispatch, providers, patients and the public API. We scope against unit count, cities and SLAs.</p>
      </header>
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 pb-16 grid md:grid-cols-3 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline">
        {PLANS.map((p) => (
          <div key={p.name} className="bg-panel p-7">
            <div className="mono text-[10px] uppercase tracking-widest text-action">{p.target}</div>
            <div className="text-2xl font-bold mt-2">{p.name}</div>
            <div className="text-4xl font-bold mono mt-3">{p.price}</div>
            <ul className="mt-5 space-y-2.5">{p.features.map((f) => (
              <li key={f} className="flex gap-2 text-sm"><CheckCircle2 className="size-4 text-stable shrink-0 mt-0.5" /><span>{f}</span></li>
            ))}</ul>
            <Link to="/demo" className="mt-6 inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-hairline mono text-[11px] uppercase tracking-widest hover:bg-panel-elevated">Get a quote <ArrowRight className="size-3.5" /></Link>
          </div>
        ))}
      </section>
      <SiteFooter />
    </div>
  );
}