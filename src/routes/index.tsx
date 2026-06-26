import { createFileRoute, Link } from "@tanstack/react-router";
import { Ambulance, Radio, Stethoscope, GraduationCap, KeyRound, ArrowRight, Hospital } from "lucide-react";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VeloMed OS — API-first medical mobility infrastructure" },
      { name: "description", content: "Dispatch console, paramedic and driver app, patient app, ambulance rental, training & certification — built on one documented public REST API." },
      { property: "og:title", content: "VeloMed OS — Medical mobility infrastructure" },
      { property: "og:description", content: "Live tracking dispatch, provider and patient apps, rentals, training, and a public REST API." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <EmergencyBanner />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-hairline">
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: "linear-gradient(var(--color-hairline) 1px, transparent 1px), linear-gradient(90deg, var(--color-hairline) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="relative max-w-[1400px] mx-auto px-4 lg:px-8 pt-20 pb-24 grid lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-panel border border-hairline mono text-[10px] uppercase tracking-[0.2em] text-action">
              <span className="size-1.5 rounded-full bg-stable animate-pulse" /> API v1.2 · Operational
            </div>
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-[0.95]">
              Medical mobility,<br/>
              <span className="text-emergency">instrumented.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              One platform for emergency dispatch, paramedics in the field, patients on the phone, fleet rental, and certification — all on a single documented REST API.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/contact" className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-emergency text-emergency-foreground mono text-xs uppercase tracking-widest font-bold hover:bg-emergency/90 shadow-[0_0_24px_oklch(0.62_0.22_27/0.35)]">
                Request help <ArrowRight className="size-3.5" />
              </Link>
              <Link to="/services" className="inline-flex items-center gap-2 px-5 py-3 rounded-md border border-hairline mono text-xs uppercase tracking-widest hover:bg-panel">
                Explore services <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-hairline bg-panel overflow-hidden">
              <div className="px-4 py-2 border-b border-hairline flex items-center justify-between mono text-[10px] uppercase tracking-widest">
                <span className="text-action">REST API · live sample</span>
                <span className="text-muted-foreground">200 OK · 84ms</span>
              </div>
              <pre className="text-[11px] leading-relaxed text-muted-foreground p-4 font-mono overflow-auto">{`GET /api/public/v1/fleet
x-api-key: vmk_••••••••

[
  { "code": "AMB-401", "type": "ALS",
    "status": "available",
    "loc": [40.7580, -73.9855] },
  { "code": "AMB-402", "type": "ALS",
    "status": "en_route",
    "loc": [40.7614, -73.9776] }
]`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* SURFACES */}
      <section id="surfaces" className="max-w-[1400px] mx-auto px-4 lg:px-8 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">Four surfaces · one fabric</div>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">Every role on the same nervous system.</h2>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline">
          {[
            { icon: Radio, title: "Dispatch Console", desc: "Live fleet map, SLA timers, intake & assignment.", to: "/dispatch" },
            { icon: Ambulance, title: "Provider App", desc: "Accept jobs, stream GPS, run the lifecycle.", to: "/provider" },
            { icon: Stethoscope, title: "Patient App", desc: "Request an ambulance, track ETA, book clinics.", to: "/patient" },
            { icon: GraduationCap, title: "Training Portal", desc: "Courses, enrollments, certificates.", to: "/training" },
          ].map((s) => (
            <Link key={s.title} to={s.to} className="bg-panel p-6 hover:bg-panel-elevated transition-colors group">
              <s.icon className="size-5 text-action mb-4" />
              <div className="text-sm font-semibold">{s.title}</div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{s.desc}</p>
              <div className="mono text-[10px] text-action uppercase tracking-widest mt-4 inline-flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                Open <ArrowRight className="size-3" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FLEET STRIP */}
      <section id="fleet" className="border-y border-hairline bg-panel/50">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-16 grid lg:grid-cols-3 gap-10">
          {[
            { kpi: "< 6 min", label: "Median dispatch-to-en-route" },
            { kpi: "5 Hz", label: "Provider GPS upstream cadence" },
            { kpi: "100%", label: "Surfaces backed by the public API" },
          ].map((k) => (
            <div key={k.label}>
              <div className="text-5xl font-bold tracking-tight mono">{k.kpi}</div>
              <div className="mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground mt-2">{k.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SECONDARY: Rentals + Training + API */}
      <section className="max-w-[1400px] mx-auto px-4 lg:px-8 py-20 grid lg:grid-cols-3 gap-6">
        <Link to="/rentals" className="rounded-xl border border-hairline bg-panel p-6 hover:bg-panel-elevated transition-colors">
          <Hospital className="size-5 text-action mb-4" />
          <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Fleet rental</div>
          <h3 className="text-xl font-semibold mt-1">ALS, BLS, ICU & Neonatal units, by the day.</h3>
          <p className="text-sm text-muted-foreground mt-3">Browse availability, lock a unit, and we'll route the keys.</p>
        </Link>
        <Link to="/training" className="rounded-xl border border-hairline bg-panel p-6 hover:bg-panel-elevated transition-colors">
          <GraduationCap className="size-5 text-emergency mb-4" />
          <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Certification</div>
          <h3 className="text-xl font-semibold mt-1">ALS, EMT-Basic, Tactical Paramedic.</h3>
          <p className="text-sm text-muted-foreground mt-3">Enroll, finish modules, get a verifiable certificate.</p>
        </Link>
        <Link to="/api-docs" className="rounded-xl border border-action/40 bg-action/5 p-6 hover:bg-action/10 transition-colors">
          <KeyRound className="size-5 text-action mb-4" />
          <div className="mono text-[10px] uppercase tracking-widest text-action">API · OpenAPI 3.1</div>
          <h3 className="text-xl font-semibold mt-1">Build on top of VeloMed.</h3>
          <p className="text-sm text-muted-foreground mt-3">Documented endpoints for fleet, incidents, courses and more. Swagger UI included.</p>
        </Link>
      </section>

      <SiteFooter />
    </div>
  );
}
