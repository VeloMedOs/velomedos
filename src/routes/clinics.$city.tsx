import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";
import { SITE } from "@/lib/site-config";
import { breadcrumbLd, jsonld } from "@/components/Jsonld";
import { MapPin, ChevronRight, ArrowRight, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/clinics/$city")({
  loader: ({ params }) => {
    const city = SITE.cities.find((c) => c.slug === params.city);
    if (!city) throw notFound();
    return { city };
  },
  head: ({ loaderData, params }) => {
    const city = loaderData?.city;
    if (!city) return {};
    const title = `Clinics & ambulance dispatch in ${city.name} — ${SITE.brand}`.slice(0, 65);
    const desc = `Find clinics, telehealth and 24/7 emergency ambulance dispatch in ${city.name}, ${city.country}. Bookable from the VeloMed patient app.`.slice(0, 158);
    const url = `/clinics/${params.city}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "index,follow" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        { type: "application/ld+json", children: jsonld({
          "@context": "https://schema.org", "@type": "MedicalClinic",
          name: `${SITE.brand} — ${city.name}`,
          areaServed: { "@type": "City", name: city.name, containedInPlace: city.country },
          address: { "@type": "PostalAddress", addressLocality: city.name, addressCountry: city.country },
          url,
          telephone: SITE.contact.phone,
        }) },
        { type: "application/ld+json", children: jsonld(breadcrumbLd([
          { name: "Home", href: "/" },
          { name: "Clinics", href: "/clinics" },
          { name: city.name, href: url },
        ])) },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-background text-foreground"><SiteHeader />
      <div className="max-w-2xl mx-auto p-16 text-center">
        <h1 className="text-3xl font-bold">City not found</h1>
        <Link to="/clinics" className="text-action mono text-[11px] uppercase tracking-widest mt-4 inline-block">All cities →</Link>
      </div>
    </div>
  ),
  component: CityPage,
});

function CityPage() {
  const { city } = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <EmergencyBanner />
      <nav aria-label="Breadcrumb" className="max-w-[1100px] mx-auto px-4 lg:px-8 pt-6 mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
        <Link to="/" className="hover:text-foreground">Home</Link><ChevronRight className="size-3" />
        <Link to="/clinics" className="hover:text-foreground">Clinics</Link><ChevronRight className="size-3" />
        <span className="text-foreground">{city.name}</span>
      </nav>
      <header className="max-w-[1100px] mx-auto px-4 lg:px-8 pt-8 pb-10">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-action mb-2 flex items-center gap-2"><MapPin className="size-3" /> {city.country}</div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">Clinics & ambulance dispatch in {city.name}</h1>
        <p className="text-lg text-muted-foreground mt-4 max-w-2xl">VeloMed operates ambulance dispatch, physical and telehealth clinics, and mobile pre-employment screening across {city.name}, {city.country}. Bookings happen in the patient app; emergencies route to our 24/7 call centre.</p>
      </header>
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 py-8 grid md:grid-cols-3 gap-4">
        {[
          { title: "Emergency dispatch", desc: `24/7 ambulance dispatch in ${city.name} with live tracking.`, to: "/services/emergency-dispatch" as const },
          { title: "Telehealth clinics", desc: `Consult a clinician from anywhere in ${city.name}.`, to: "/services/remote-clinics" as const },
          { title: "Mobile screening", desc: `Pre-employment medicals delivered to your ${city.name} site.`, to: "/services/mobile-screening" as const },
        ].map((c) => (
          <Link key={c.title} to={c.to} className="rounded-lg border border-hairline bg-panel p-5 hover:bg-panel-elevated transition-colors">
            <Stethoscope className="size-5 text-action mb-3" />
            <div className="text-sm font-semibold">{c.title}</div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{c.desc}</p>
            <div className="mono text-[10px] text-action uppercase tracking-widest mt-3 inline-flex items-center gap-1">Learn more <ArrowRight className="size-3" /></div>
          </Link>
        ))}
      </section>
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 py-12">
        <h2 className="text-xl font-semibold mb-4">Other cities we serve</h2>
        <div className="flex flex-wrap gap-2">
          {SITE.cities.filter((c) => c.slug !== city.slug).map((c) => (
            <Link key={c.slug} to="/clinics/$city" params={{ city: c.slug }} className="px-3 py-1.5 rounded-md border border-hairline bg-panel mono text-[11px] uppercase tracking-widest hover:bg-panel-elevated">{c.name}</Link>
          ))}
        </div>
      </section>
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 py-16 text-center border-t border-hairline">
        <h2 className="text-3xl font-bold">Need help in {city.name}?</h2>
        <p className="text-muted-foreground mt-3">For dispatchable non-emergency requests, our call centre in {city.name} responds live.</p>
        <Link to="/contact" className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-md bg-emergency text-emergency-foreground mono text-xs uppercase tracking-widest font-bold">Request help <ArrowRight className="size-3.5" /></Link>
      </section>
      <SiteFooter />
    </div>
  );
}