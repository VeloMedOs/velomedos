import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";
import {
  ArrowRight, Radio, Ambulance, GraduationCap, Stethoscope,
  ShieldCheck, MapPin, Activity, Sparkles, Globe2, HeartPulse,
} from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — VeloMed OS" },
      { name: "description", content: "VeloMed OS is the branch-aware operating system for medical mobility — ambulance rental, remote clinics, certified training and dispatch, run on one network." },
      { property: "og:title", content: "About VeloMed OS" },
      { property: "og:description", content: "One platform for ambulance rental, remote clinics, training and dispatch — engineered for multi-branch operators in KSA and the GCC." },
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

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-hairline">
        <div aria-hidden className="absolute inset-0 opacity-60" style={{ background: "radial-gradient(900px 420px at 12% 0%, color-mix(in oklab, var(--color-teal) 16%, transparent), transparent 60%), radial-gradient(700px 360px at 88% 10%, color-mix(in oklab, var(--color-blue) 14%, transparent), transparent 65%)" }} />
        <div className="signal-bar absolute top-0 left-0 right-0" />
        <div className="max-w-[1200px] mx-auto px-4 lg:px-8 pt-20 pb-16 relative">
          <div className="brand-eyebrow text-teal mb-3 inline-flex items-center gap-2"><Sparkles className="size-3" /> About VeloMed OS</div>
          <h1 className="text-4xl lg:text-6xl font-bold tracking-tight max-w-4xl leading-[1.05]">
            One operating system for <span className="italic" style={{ background: "var(--gradient-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>medical mobility</span>.
          </h1>
          <p className="text-muted-foreground mt-5 max-w-2xl text-lg leading-relaxed">
            VeloMed OS is a branch-aware platform built for operators who run ambulances, remote &amp; mobile clinics, corporate screening, and accredited training — sometimes all four under the same roof. From your whole network down to one crew, on one console.
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <Link to="/demo" className="inline-flex items-center gap-2 px-5 py-3 rounded-md text-background mono text-xs uppercase tracking-widest font-bold" style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-glow-teal)" }}>Book a demo <ArrowRight className="size-3.5" /></Link>
            <Link to="/platform" className="inline-flex items-center gap-2 px-5 py-3 rounded-md border border-hairline mono text-xs uppercase tracking-widest hover:bg-panel">How the platform works <ArrowRight className="size-3.5" /></Link>
          </div>
        </div>
      </section>

      {/* PRINCIPLES */}
      <section className="max-w-[1200px] mx-auto px-4 lg:px-8 py-16">
        <div className="grid lg:grid-cols-12 gap-8 items-end mb-8">
          <div className="lg:col-span-7">
            <div className="brand-eyebrow text-muted-foreground mb-2">Our principles</div>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">Built for operators who can&apos;t afford a missed minute.</h2>
          </div>
          <p className="lg:col-span-5 text-muted-foreground">Every screen — dispatch console, paramedic app, patient app, rental and training portals — runs on one branch-aware data model so a regional manager sees their exposure and the network owner sees everyone&apos;s.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline">
          {[
            { icon: MapPin, t: "Branch-aware by default", d: "Network → region → district → branch → crew. Roles, KPIs and RLS all scope the same way." },
            { icon: ShieldCheck, t: "Compliance gates dispatch", d: "Expired vehicle registration or a critical defect quietly removes the unit from the assignable pool." },
            { icon: Activity, t: "Telemetry, not theatre", d: "Honest dashboards — 5 Hz GPS, real ETA from live road conditions, audited from the first packet." },
          ].map((c) => (
            <div key={c.t} className="bg-panel p-6">
              <c.icon className="size-5 text-teal mb-4" />
              <div className="text-base font-semibold">{c.t}</div>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHAT WE OPERATE */}
      <section className="border-y border-hairline bg-panel/30">
        <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-16">
          <div className="brand-eyebrow text-blue mb-2">What VeloMed OS runs</div>
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight max-w-3xl">Four service lines. One audited spine.</h2>
          <p className="text-muted-foreground mt-3 max-w-2xl">Operators usually start with one line and add the others as the network grows. The data model, roles and reporting are the same on day one and day one thousand.</p>
          <div className="mt-8 grid md:grid-cols-2 gap-4">
            {[
              { icon: Ambulance, color: "var(--color-blue)", t: "Ambulance rental &amp; emergency dispatch", d: "Hourly, event and contract rental with live tracking, severity-banded SLAs and one-tap assignment from the call centre.", to: "/services/emergency-dispatch" },
              { icon: Stethoscope, color: "var(--color-teal)", t: "Remote &amp; mobile clinics", d: "Bookable physical clinics, mobile units and telehealth — branded for your network, governed by one schedule.", to: "/services/remote-clinics" },
              { icon: GraduationCap, color: "var(--color-coral)", t: "Training &amp; certification", d: "Accredited courses, learner records, exam workflows and credentials that expire into your compliance roll-up.", to: "/services/training-certification" },
              { icon: HeartPulse, color: "var(--color-amber)", t: "Mobile screening &amp; corporate health", d: "On-site events with kits, intake forms, results capture and downstream care routing.", to: "/services/mobile-screening" },
            ].map((s) => (
              <Link key={s.t} to={s.to} className="group rounded-xl border border-hairline bg-background/50 p-6 hover:border-teal/40 transition-colors">
                <s.icon className="size-6 mb-4" style={{ color: s.color }} />
                <div className="text-lg font-semibold" dangerouslySetInnerHTML={{ __html: s.t }} />
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: s.d }} />
                <div className="mono text-[10px] uppercase tracking-widest mt-4 inline-flex items-center gap-1 text-teal opacity-70 group-hover:opacity-100">Explore line <ArrowRight className="size-3" /></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="max-w-[1200px] mx-auto px-4 lg:px-8 py-16">
        <div className="brand-eyebrow text-coral mb-2">Who it&apos;s for</div>
        <h2 className="text-3xl lg:text-4xl font-bold tracking-tight max-w-3xl">Six roles. One console. Zero context-switching.</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-px bg-hairline border border-hairline rounded-xl overflow-hidden">
          {[
            { t: "Network owners", d: "P&amp;L, utilisation and exposure across every branch in one map." },
            { t: "Call-centre dispatchers", d: "Branch-scoped queues, severity banding and audit-grade handoff." },
            { t: "Paramedics &amp; drivers", d: "Native provider app with offline-safe forms, e-PCR and signatures." },
            { t: "Clinicians", d: "Telehealth, remote-clinic schedule and screening review in one inbox." },
            { t: "Patients", d: "Booking, live ETA, secure chat and family share-links." },
            { t: "Auditors &amp; regulators", d: "Tamper-evident logs, PDPL/HIPAA-aligned exports on demand." },
          ].map((r) => (
            <div key={r.t} className="bg-panel p-6">
              <div className="text-sm font-semibold" dangerouslySetInnerHTML={{ __html: r.t }} />
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: r.d }} />
            </div>
          ))}
        </div>
      </section>

      {/* GEOGRAPHY + COMPLIANCE */}
      <section className="border-t border-hairline">
        <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-16 grid md:grid-cols-2 gap-6">
          <div className="instrument-panel rounded-xl p-7">
            <Globe2 className="size-5 text-teal mb-4" />
            <h3 className="text-xl font-semibold">Engineered in &amp; for the GCC</h3>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              Headquartered for Saudi Arabia and the wider GCC, with city-aware dispatch from Riyadh and Jeddah to Dubai and Doha. Bilingual surfaces, Hijri-aware schedules, and a data residency story your CISO will actually read.
            </p>
            <div className="mt-5 flex flex-wrap gap-1.5 mono text-[10px] uppercase tracking-[0.18em]">
              {["Riyadh","Jeddah","Dammam","Dubai","Abu Dhabi","Doha","Manama","Muscat"].map((c) => (
                <span key={c} className="px-2 py-1 rounded border border-hairline bg-background/40 text-muted-foreground">{c}</span>
              ))}
            </div>
          </div>
          <div className="instrument-panel rounded-xl p-7">
            <ShieldCheck className="size-5 text-blue mb-4" />
            <h3 className="text-xl font-semibold">Compliance is a first-class object</h3>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              KSA PDPL, GCC data-protection regimes, HIPAA-aligned safeguards and NCA ECC-1 controls aren&apos;t a PDF in a drawer — they&apos;re tables, policies and gates that block unsafe operations before they happen.
            </p>
            <div className="mt-5 flex flex-wrap gap-1.5 mono text-[10px] uppercase tracking-[0.18em]">
              {["KSA PDPL","GCC DPL","HIPAA-aligned","NCA ECC-1","ISO 27001 path","Audit-grade logs"].map((c) => (
                <span key={c} className="px-2 py-1 rounded border border-hairline bg-background/40 text-muted-foreground">{c}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* KPI STRIP */}
      <section className="border-t border-hairline bg-panel/30">
        <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-12 grid md:grid-cols-4 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline my-10">
          {[
            { kpi: "5 Hz", label: "Provider GPS upstream" },
            { kpi: "< 6 min", label: "Median dispatch → en-route" },
            { kpi: "4", label: "Service lines · one spine" },
            { kpi: "24 / 7", label: "Call-centre coverage" },
          ].map((s) => (
            <div key={s.label} className="bg-panel p-7">
              <div className="text-3xl lg:text-4xl font-bold mono tracking-tight" style={{ background: "var(--gradient-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{s.kpi}</div>
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mt-3">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-hairline">
        <div className="max-w-[1100px] mx-auto px-4 lg:px-8 py-20 text-center">
          <div className="brand-eyebrow text-teal mb-3 inline-flex items-center gap-2 justify-center"><Radio className="size-3" /> Ready when you are</div>
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight">See your whole network <span className="italic" style={{ background: "var(--gradient-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>on the map.</span></h2>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto">Thirty-minute working session with your operations lead. We bring the console, you bring one branch&apos;s real workflow.</p>
          <div className="flex flex-wrap gap-3 mt-7 justify-center">
            <Link to="/demo" className="inline-flex items-center gap-2 px-5 py-3 rounded-md text-background mono text-xs uppercase tracking-widest font-bold" style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-glow-teal)" }}>Book a demo <ArrowRight className="size-3.5" /></Link>
            <Link to="/contact" className="inline-flex items-center gap-2 px-5 py-3 rounded-md border border-hairline mono text-xs uppercase tracking-widest hover:bg-panel">Talk to us <ArrowRight className="size-3.5" /></Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}