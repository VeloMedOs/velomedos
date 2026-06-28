import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { CommandHero } from "@/components/CommandHero";
import { ArrowRight, Building2, Layers, Users, Activity, ShieldCheck, Cable } from "lucide-react";
import { breadcrumbLd, jsonld } from "@/components/Jsonld";

const title = "Platform — Network · Region · Team | VeloMed OS";
const desc = "Branch-aware OS for multi-branch medical mobility: drill from the whole network into a region's live cases, down to a single crew on one canvas.";

export const Route = createFileRoute("/platform")({
  head: () => ({
    meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:url", content: "/platform" }, { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" }, { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/platform" }],
    scripts: [{ type: "application/ld+json", children: jsonld(breadcrumbLd([
      { name: "Home", href: "/" }, { name: "Platform", href: "/platform" },
    ])) }],
  }),
  component: Platform,
});

function Platform() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <CommandHero />

      {/* THE SPINE */}
      <section className="max-w-[1400px] mx-auto px-4 lg:px-8 py-20">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal mb-2">The one idea</div>
        <h2 className="font-serif text-4xl lg:text-5xl tracking-tight max-w-3xl">Branch is the spine of the whole product.</h2>
        <p className="text-muted-foreground mt-4 max-w-2xl">Every view, permission, queue, report and alert is scoped to a hierarchy: Organisation → Branch → Region/District → Team → Case. Roles grant access at the branch level; managers see theirs, org admins see all.</p>

        <div className="mt-10 grid md:grid-cols-5 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline">
          {[
            { icon: Building2, label: "Organisation", desc: "The customer account." },
            { icon: Layers,    label: "Branch",       desc: "A business unit; the level operators manage by." },
            { icon: Layers,    label: "Region / District", desc: "Operating area inside a branch." },
            { icon: Users,     label: "Team",         desc: "A crew + vehicle." },
            { icon: Activity,  label: "Case",         desc: "A patient or request." },
          ].map((s, i) => (
            <div key={s.label} className="bg-panel p-5">
              <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Level {i+1}</div>
              <s.icon className="size-5 text-teal mt-3" />
              <div className="font-semibold mt-2">{s.label}</div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* THREE-LEVEL MAP */}
      <section className="border-y border-hairline bg-panel/30">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-20">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal mb-2">The live map</div>
          <h2 className="font-serif text-4xl lg:text-5xl tracking-tight">Network, region, team — one canvas.</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {[
              { title: "Network", body: "All branches across the kingdom as live nodes with active-case and team counts. Click a branch to drill into its region." },
              { title: "Region",  body: "Google satellite/hybrid for that branch with district overlays, live case markers by severity, and available units." },
              { title: "Team",    body: "One crew running A→B. Destination pinned with live time-to-arrival. The travelled route fills behind the moving vehicle." },
            ].map((c, i) => (
              <div key={c.title} className="rounded-xl border border-hairline bg-panel p-6">
                <div className="mono text-[10px] uppercase tracking-widest text-teal">Level {i+1}</div>
                <div className="font-serif text-2xl mt-2">{c.title}</div>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* THREE LENSES */}
      <section className="max-w-[1400px] mx-auto px-4 lg:px-8 py-20">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal mb-2">The team magnifier</div>
        <h2 className="font-serif text-4xl lg:text-5xl tracking-tight max-w-3xl">Three lenses, one crew — real operational decision support.</h2>
        <div className="mt-10 grid md:grid-cols-3 gap-6">
          {[
            { title: "Movement", body: "Speed from successive GPS pings, road ETA via the Directions/Distance Matrix API, distance left, trip time, A→B progress." },
            { title: "Patient onboard", body: "Acuity/priority and vitals (HR, BP, SpO₂, GCS) entered by the crew, with a clinical note and a one-tap pre-alert to the receiving hospital." },
            { title: "Next request", body: "The next case queued to this vehicle from the dispatch queue, and the estimated time-to-respond after handoff." },
          ].map((c) => (
            <div key={c.title} className="rounded-xl border border-hairline bg-panel p-6">
              <div className="font-serif text-2xl">{c.title}</div>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECURITY / API */}
      <section className="border-t border-hairline bg-panel/30">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-20 grid lg:grid-cols-2 gap-10">
          <div className="rounded-xl border border-hairline bg-panel p-6">
            <ShieldCheck className="size-5 text-teal mb-3" />
            <div className="font-serif text-2xl">Scoped by row, not by promise</div>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">Branch_id, region_id and district_id are first-class on every operational table. Row-Level Security extends to branch, so a user only ever sees rows their role grants.</p>
          </div>
          <div className="rounded-xl border border-hairline bg-panel p-6">
            <Cable className="size-5 text-teal mb-3" />
            <div className="font-serif text-2xl">Same surface for your apps</div>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">Every screen reads and writes through the documented public REST API. Webhooks fire for incident, trip and compliance events. Build your own dashboards without rebuilding the stack.</p>
            <Link to="/contact" className="mt-4 inline-flex items-center gap-1 mono text-[10px] uppercase tracking-widest text-teal hover:gap-2 transition-all">Talk to integration <ArrowRight className="size-3" /></Link>
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section className="border-t border-hairline">
        <div className="max-w-[1100px] mx-auto px-4 lg:px-8 py-24 text-center">
          <h2 className="font-serif text-4xl lg:text-5xl tracking-tight">See your whole network <span className="italic text-teal">on the map.</span></h2>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <Link to="/demo" className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-teal text-background mono text-xs uppercase tracking-widest font-bold">Book a demo <ArrowRight className="size-3.5" /></Link>
            <Link to="/contact" className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-hairline mono text-xs uppercase tracking-widest hover:bg-panel">Talk to us <ArrowRight className="size-3.5" /></Link>
            <Link to="/resources/comparison" className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-hairline mono text-xs uppercase tracking-widest hover:bg-panel">VeloMed OS vs ESO Suite <ArrowRight className="size-3.5" /></Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}