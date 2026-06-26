import { createFileRoute, Link } from "@tanstack/react-router";
import { Radio, ShieldCheck, Stethoscope, ClipboardCheck, GraduationCap, KeyRound, ArrowRight } from "lucide-react";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services — VeloMed OS" },
      { name: "description", content: "Emergency dispatch & live tracking, fleet compliance, remote clinics, mobile screening, training & certification, and the public developer API." },
      { property: "og:title", content: "VeloMed OS — Services" },
      { property: "og:description", content: "Six services, one platform: dispatch, compliance, clinics, screening, training, public API." },
    ],
  }),
  component: Services,
});

const SERVICES = [
  { icon: Radio, title: "Emergency dispatch & live tracking", body: "24/7 call-center console with SLA timers, road-based ETA, and 5-second GPS from every unit, paramedic and doctor on shift.", cta: ["Request help", "/contact"] as const, hue: "text-emergency", border: "border-emergency/30" },
  { icon: ShieldCheck, title: "Fleet compliance & maintenance", body: "Vehicle credentials with expiry alerts, defect intake from the field, and work-order tracking that gates dispatch when a unit isn't roadworthy.", cta: ["See the API", "/api-docs"] as const, hue: "text-action", border: "border-hairline" },
  { icon: Stethoscope, title: "Remote clinics", body: "Bookable physical, mobile and telehealth clinics across the regions we cover — specialties, hours and live availability.", cta: ["Browse clinics", "/clinics"] as const, hue: "text-action", border: "border-hairline" },
  { icon: ClipboardCheck, title: "Mobile pre-employment screening", body: "Corporate packages delivered on-site by our mobile units — bloods, vitals, drug & alcohol, occupational health.", cta: ["Contact our team", "/contact"] as const, hue: "text-action", border: "border-hairline" },
  { icon: GraduationCap, title: "Training & certification", body: "ALS, EMT-Basic, Tactical Paramedic and refresher courses with verifiable certificates issued on completion.", cta: ["Explore courses", "/contact"] as const, hue: "text-emergency", border: "border-hairline" },
  { icon: KeyRound, title: "Public developer API", body: "Documented OpenAPI 3.1 surface for fleet status, incident intake, clinic directory, courses, compliance and live ETA — with scoped API keys.", cta: ["Read the API", "/api-docs"] as const, hue: "text-action", border: "border-action/40" },
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
            <Link to={s.cta[1]} className="mt-5 inline-flex items-center gap-1 mono text-[10px] uppercase tracking-widest text-action hover:gap-2 transition-all">
              {s.cta[0]} <ArrowRight className="size-3" />
            </Link>
          </article>
        ))}
      </section>
      <SiteFooter />
    </div>
  );
}