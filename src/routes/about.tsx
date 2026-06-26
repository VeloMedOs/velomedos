import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — VeloMed OS" },
      { name: "description", content: "VeloMed Infrastructure Group operates ambulance fleets, remote clinics, and a public medical-mobility API across multiple regions." },
      { property: "og:title", content: "About VeloMed OS" },
      { property: "og:description", content: "Who we are, what we operate, and how the platform fits together." },
      { property: "og:url", content: "/about" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: About,
});

function About() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <EmergencyBanner />
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 pt-16 pb-12">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">About us</div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">An API-first operator of medical mobility.</h1>
        <p className="text-muted-foreground mt-4 max-w-2xl text-lg">VeloMed Infrastructure Group runs ambulance fleets, remote and mobile clinics, corporate screening units, and an accredited training school — all stitched together by one documented public API.</p>
      </section>
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 pb-16 grid md:grid-cols-3 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline">
        {[
          { kpi: "5 Hz", label: "Provider GPS upstream" },
          { kpi: "< 6 min", label: "Median dispatch-to-en-route" },
          { kpi: "100%", label: "Surfaces on the public API" },
        ].map((s) => (
          <div key={s.label} className="bg-panel p-8">
            <div className="text-4xl font-bold mono tracking-tight">{s.kpi}</div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mt-3">{s.label}</div>
          </div>
        ))}
      </section>
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 pb-24 grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-hairline bg-panel p-6">
          <h2 className="text-xl font-semibold">How the platform is built</h2>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">Dispatch console, paramedic & driver app, patient app, rental, training and screening modules all read and write through the same REST endpoints third parties consume. Compliance gates dispatch eligibility: an expired vehicle registration or critical defect removes the unit from the assignable pool automatically.</p>
          <Link to="/api-docs" className="mt-5 inline-flex items-center gap-1 mono text-[10px] uppercase tracking-widest text-action hover:gap-2 transition-all">Read the API <ArrowRight className="size-3" /></Link>
        </div>
        <div className="rounded-xl border border-emergency/30 bg-emergency/5 p-6">
          <h2 className="text-xl font-semibold">Need help right now?</h2>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">For life-threatening emergencies, call your local emergency number. For dispatchable non-911 transport within our operating regions, submit a request and our call centre will pick it up live.</p>
          <Link to="/contact" className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emergency text-emergency-foreground mono text-[10px] uppercase tracking-widest font-bold">Request help <ArrowRight className="size-3" /></Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}