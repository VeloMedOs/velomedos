import { createFileRoute, Link } from "@tanstack/react-router";
import { Radio, ShieldCheck, Stethoscope, ClipboardCheck, GraduationCap, HeartHandshake, ArrowRight } from "lucide-react";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";
import { breadcrumbLd, jsonld } from "@/components/Jsonld";

export const Route = createFileRoute("/services/")({
  head: () => ({
    meta: [
      { title: "Services — VeloMed OS" },
      { name: "description", content: "Emergency dispatch & live tracking, fleet compliance, remote clinics, mobile screening, training & certification, and verified homecare visits." },
      { property: "og:title", content: "VeloMed OS — Services" },
      { property: "og:description", content: "Six services, one platform: dispatch, compliance, clinics, screening, training, homecare." },
      { property: "og:url", content: "/services" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/services" }],
    scripts: [{ type: "application/ld+json", children: jsonld(breadcrumbLd([
      { name: "Home", href: "/" }, { name: "Services", href: "/services" },
    ])) }],
  }),
  component: Services,
});

const SERVICES = [
  { icon: Radio, title: "Emergency dispatch & live tracking", body: "24/7 call-center console with SLA timers, road-based ETA, and 5-second GPS from every unit, paramedic and doctor on shift.", to: "/services/emergency-dispatch" as const, hue: "text-emergency", border: "border-emergency/30" },
  { icon: ShieldCheck, title: "Fleet compliance & maintenance", body: "Vehicle credentials with expiry alerts, defect intake from the field, and work-order tracking that gates dispatch when a unit isn't roadworthy.", to: "/services/fleet-compliance" as const, hue: "text-action", border: "border-hairline" },
  { icon: Stethoscope, title: "Remote clinics & telehealth", body: "Bookable physical, mobile and telehealth clinics across the regions we cover — specialties, hours and live availability.", to: "/services/remote-clinics" as const, hue: "text-action", border: "border-hairline" },
  { icon: ClipboardCheck, title: "Mobile pre-employment screening", body: "Corporate packages delivered on-site by our mobile units — bloods, vitals, drug & alcohol, occupational health.", to: "/services/mobile-screening" as const, hue: "text-action", border: "border-hairline" },
  { icon: GraduationCap, title: "Training & certification", body: "ALS, EMT-Basic, Tactical Paramedic and refresher courses with verifiable certificates issued on completion.", to: "/services/training-certification" as const, hue: "text-emergency", border: "border-hairline" },
  { icon: HeartHandshake, title: "Homecare Service", body: "Recurring in-home nursing and caregiver visits — scheduled, routed and geofenced check-in/out, with vitals, medications and care-plan tasks captured at the bedside.", to: "/services/homecare" as const, hue: "text-stable", border: "border-stable/40" },
];

function Services() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <EmergencyBanner />
      <section className="max-w-[1400px] mx-auto px-4 lg:px-8 pt-16 pb-10">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">What we run</div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight max-w-3xl">Six services. One nervous system.</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl">Every surface — dispatch, providers, patients, partners — is backed by the same documented REST API and the same fleet of vehicles, clinicians and clinics.</p>
      </section>
      <section className="max-w-[1400px] mx-auto px-4 lg:px-8 pb-24 grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline">
        {SERVICES.map((s) => (
          <article key={s.title} className={`bg-panel p-6 flex flex-col ${s.border}`}>
            <s.icon className={`size-6 ${s.hue} mb-4`} />
            <h2 className="text-lg font-semibold leading-snug">{s.title}</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed flex-1">{s.body}</p>
            <Link to={s.to} className="mt-5 inline-flex items-center gap-1 mono text-[10px] uppercase tracking-widest text-action hover:gap-2 transition-all">
              Explore {s.title.toLowerCase()} <ArrowRight className="size-3" />
            </Link>
          </article>
        ))}
      </section>
      <SiteFooter />
    </div>
  );
}