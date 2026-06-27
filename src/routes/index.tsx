import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Radio, Wrench, BadgeCheck, GraduationCap, Stethoscope, Code2, MapPin, AlertTriangle, ClipboardCheck } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { faqLd, jsonld } from "@/components/Jsonld";
import { CommandHero } from "@/components/CommandHero";

const HOME_FAQS = [
  { q: "Who is VeloMed OS built for?", a: "Multi-branch care operators: ambulance services running many branches, mobile-clinic companies, home/remote care providers, and site/occupational health teams in mining, construction, camps and clubs." },
  { q: "How does the branch hierarchy work?", a: "Every view, queue, permission, report and alert is scoped to Organisation → Branch → Region/District → Team → Case. A regional manager sees the branches their role grants; org admins see the whole network." },
  { q: "What does the three-level map actually show?", a: "Network: all your branches across the kingdom. Region: a real satellite map of one branch with live cases by severity. Team: one crew running A→B with the destination pinned, live vitals and the next queued case." },
  { q: "Do you offer an API?", a: "Yes — a documented public REST API (OpenAPI 3.1) powers the same surfaces our own apps use, with scoped keys and webhooks for incident, trip and compliance events." },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VeloMed OS — From your whole network down to one crew" },
      { name: "description", content: "The branch-aware operating system for multi-branch medical mobility operators. Drill from your network, into a region's live cases, down to a single team and the patient in its care." },
      { property: "og:title", content: "VeloMed OS — Network · Region · Team" },
      { property: "og:description", content: "Branch-aware OS for multi-branch medical mobility: dispatch, fleet, licensing, clinics and a public REST API." },
      { property: "og:url", content: "/" },
      { name: "twitter:title", content: "VeloMed OS — Network · Region · Team" },
      { name: "twitter:description", content: "Branch-aware OS for multi-branch medical mobility operators." },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [{ type: "application/ld+json", children: jsonld(faqLd(HOME_FAQS)) }],
  }),
  component: Index,
});

function Index() {
  const [stats, setStats] = useState<{ branches_live: number; active_cases: number; teams_live: number; credentials_expiring_7d: number } | null>(null);
  useEffect(() => {
    let cancel = false;
    fetch("/api/public/v1/stats").then((r) => r.ok ? r.json() : null).then((d) => { if (!cancel && d) setStats(d); }).catch(() => {});
    return () => { cancel = true; };
  }, []);
  const items = [
    { kpi: stats?.branches_live ?? 5, label: "Branches live" },
    { kpi: stats?.active_cases ?? 0, label: "Active cases across the network" },
    { kpi: stats?.teams_live ?? 0, label: "Teams live now" },
    { kpi: stats?.credentials_expiring_7d ?? 0, label: "Credentials expiring this week" },
  ];
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <CommandHero />

      {/* TRUST / STAT STRIP */}
      <section className="border-b border-hairline bg-panel/40">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-px bg-hairline">
          {items.map((k) => (
            <div key={k.label} className="bg-background/40 px-6 py-5">
              <div className="text-3xl font-bold tracking-tight mono">{String(k.kpi)}</div>
              <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1.5">{k.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PROBLEM — operator's voice */}
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 py-20">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal mb-2">If you've ever asked…</div>
        <h2 className="font-serif text-4xl lg:text-5xl tracking-tight">The three questions every ops lead asks every day.</h2>
        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {[
            { icon: MapPin, q: "Where is everyone?", a: "Drill from network to region to a single crew. Live position, speed and trip progress — without phoning around." },
            { icon: AlertTriangle, q: "Did we miss that case?", a: "One queue across branches with SLA timers and severity. No case orphaned between dispatchers, branches or shifts." },
            { icon: ClipboardCheck, q: "Is that licence still valid?", a: "Vehicle and clinician credentials gate dispatch automatically. Expired = unassignable. The roll-up tells you what expires this week." },
          ].map((p) => (
            <div key={p.q} className="rounded-xl border border-hairline bg-panel p-5">
              <p.icon className="size-5 text-teal mb-3" />
              <div className="text-lg font-semibold">"{p.q}"</div>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{p.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHAT IT DOES — six capabilities */}
      <section className="border-y border-hairline bg-panel/30">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-20">
          <div className="grid lg:grid-cols-12 gap-10 items-end mb-10">
            <div className="lg:col-span-7">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal mb-2">What it does</div>
              <h2 className="font-serif text-4xl lg:text-5xl tracking-tight">Six capabilities, framed as outcomes.</h2>
            </div>
            <p className="lg:col-span-5 text-muted-foreground">Each capability scopes to your branch hierarchy and rolls up cleanly to the network — so a regional manager sees their exposure, and the org admin sees everyone's.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline">
            {[
              { icon: MapPin, title: "Live geo-tracking", desc: "Network → region → crew, on a real satellite map with road-based ETA.", to: "/platform" },
              { icon: Radio, title: "Cases & dispatch", desc: "Branch-aware queues, severity-banded SLAs, one-tap assignment.", to: "/services/emergency-dispatch" },
              { icon: BadgeCheck, title: "Staff performance", desc: "Response, on-scene, handoff and trip metrics by team, district, region.", to: "/services/emergency-dispatch" },
              { icon: Wrench, title: "Maintenance", desc: "Defects, work orders and service intervals that pull units out of the pool.", to: "/services/fleet-compliance" },
              { icon: GraduationCap, title: "Licensing & certification", desc: "Vehicle & clinician credentials with expiry roll-ups by branch.", to: "/services/training-certification" },
              { icon: Code2, title: "Developer API", desc: "Same REST endpoints we use. Scoped keys, webhooks, OpenAPI 3.1.", to: "/developers" },
            ].map((c) => (
              <Link key={c.title} to={c.to} className="bg-panel p-6 hover:bg-panel-elevated transition-colors group">
                <c.icon className="size-5 text-teal mb-4" />
                <div className="text-base font-semibold">{c.title}</div>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{c.desc}</p>
                <div className="mono text-[10px] text-teal uppercase tracking-widest mt-4 inline-flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                  Explore <ArrowRight className="size-3" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="max-w-[1400px] mx-auto px-4 lg:px-8 py-20">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal mb-2">Who it's for</div>
        <h2 className="font-serif text-4xl lg:text-5xl tracking-tight max-w-3xl">Operators running care across many locations.</h2>
        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "Multi-branch ambulance operators", desc: "Private and public services running fleets across a kingdom or country." },
            { title: "Mobile-clinic companies", desc: "Field clinics in trucks, buses and pop-ups with bookable slots and credentials." },
            { title: "Home & remote care", desc: "Visiting clinicians and remote-site teams scoped to the branch they serve." },
            { title: "Site & occupational health", desc: "Mining, construction, camps, clubs — on-site care with corporate reporting." },
          ].map((w) => (
            <div key={w.title} className="rounded-xl border border-hairline bg-panel p-5">
              <Stethoscope className="size-5 text-teal mb-3" />
              <div className="font-semibold">{w.title}</div>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{w.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-[1100px] mx-auto px-4 lg:px-8 py-16 border-t border-hairline">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">Frequently asked</div>
        <h2 className="font-serif text-3xl tracking-tight mb-6">Questions operators ask first.</h2>
        <div className="divide-y divide-hairline border border-hairline rounded-xl bg-panel">
          {HOME_FAQS.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="cursor-pointer text-sm font-medium">{f.q}</summary>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="border-t border-hairline">
        <div className="max-w-[1100px] mx-auto px-4 lg:px-8 py-24 text-center">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal mb-3">Final word</div>
          <h2 className="font-serif text-4xl lg:text-6xl tracking-tight leading-[1.02]">See your whole network<br/><span className="italic text-teal">on the map in 30 minutes.</span></h2>
          <p className="text-muted-foreground mt-5 max-w-xl mx-auto">We'll bring the sample data — branches, regions, crews and live cases — preloaded with your operating cities.</p>
          <div className="mt-7 flex flex-wrap gap-3 justify-center">
            <Link to="/demo" className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-teal text-background mono text-xs uppercase tracking-widest font-bold shadow-[0_0_28px_oklch(0.74_0.13_195/0.35)]">Book a demo <ArrowRight className="size-3.5" /></Link>
            <Link to="/contact" className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-hairline mono text-xs uppercase tracking-widest hover:bg-panel">Talk to us <ArrowRight className="size-3.5" /></Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
