import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";
import { KeyRound, Webhook, ShieldCheck, Code2, ArrowRight } from "lucide-react";
import { SITE } from "@/lib/site-config";
import { breadcrumbLd, jsonld } from "@/components/Jsonld";

const title = "Public medical dispatch & fleet tracking API — VeloMed OS";
const desc = "Documented OpenAPI 3.1 surface for ambulance fleet, incidents, clinics, courses, compliance and live ETA. Scoped API keys, webhooks, sandbox tenants.";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:url", content: "/developers" }, { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" }, { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/developers" }],
    scripts: [
      { type: "application/ld+json", children: jsonld({
        "@context": "https://schema.org", "@type": "SoftwareApplication",
        name: `${SITE.brand} REST API`, applicationCategory: "BusinessApplication",
        operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        url: "/developers",
      }) },
      { type: "application/ld+json", children: jsonld(breadcrumbLd([
        { name: "Home", href: "/" }, { name: "Developers", href: "/developers" },
      ])) },
    ],
  }),
  component: Developers,
});

function Developers() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <EmergencyBanner />
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 pt-16 pb-10">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-action mb-2">Developers · API v1.2</div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">Build on the same API we run on.</h1>
        <p className="text-muted-foreground mt-4 max-w-2xl text-lg">Every surface — dispatch console, provider app, patient app — reads and writes through the same documented REST endpoints. Generate a scoped API key, point at the OpenAPI spec, and ship.</p>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link to="/api-reference" className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-action text-action-foreground mono text-xs uppercase tracking-widest font-bold">Try the API <ArrowRight className="size-3.5" /></Link>
          <Link to="/api-docs" className="inline-flex items-center gap-2 px-5 py-3 rounded-md border border-hairline mono text-xs uppercase tracking-widest hover:bg-panel">Full reference <ArrowRight className="size-3.5" /></Link>
          <Link to="/contact" className="inline-flex items-center gap-2 px-5 py-3 rounded-md border border-hairline mono text-xs uppercase tracking-widest hover:bg-panel">Request access <ArrowRight className="size-3.5" /></Link>
        </div>
      </section>
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 py-12 grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline">
        {[
          { icon: Code2, t: "OpenAPI 3.1", d: "Spec + Swagger UI. Generate clients in any language." },
          { icon: KeyRound, t: "Scoped keys", d: "Per-key scopes for fleet, incidents, clinics, compliance." },
          { icon: Webhook, t: "Webhooks", d: "Subscribe to incident, trip and compliance events." },
          { icon: ShieldCheck, t: "Audit log", d: "Every API call is auditable per tenant." },
        ].map((c) => (
          <div key={c.t} className="bg-panel p-6">
            <c.icon className="size-5 text-action mb-4" />
            <div className="text-sm font-semibold">{c.t}</div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{c.d}</p>
          </div>
        ))}
      </section>
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 pb-20">
        <div className="rounded-xl border border-hairline bg-panel overflow-hidden">
          <div className="px-4 py-2 border-b border-hairline flex items-center justify-between mono text-[10px] uppercase tracking-widest">
            <span className="text-action">curl · dispatch an incident</span><span className="text-muted-foreground">201 Created</span>
          </div>
          <pre className="text-[11px] leading-relaxed text-muted-foreground p-4 font-mono overflow-auto">{`curl -X POST https://api.velomed.health/v1/incidents \\
  -H "x-api-key: vmk_••••••••" \\
  -H "content-type: application/json" \\
  -d '{
    "severity": "code_red",
    "patient_name": "Anon",
    "pickup_lat": 25.2048, "pickup_lng": 55.2708,
    "symptoms": "Chest pain"
  }'`}</pre>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}