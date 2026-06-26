import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { SITE } from "@/lib/site-config";

const title = "Privacy policy — VeloMed OS";
const desc = "How VeloMed Infrastructure Group collects, uses and protects personal and clinical data across the VeloMed OS platform.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:url", content: "/privacy" }, { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <article className="max-w-[800px] mx-auto px-4 lg:px-8 py-16">
        <h1 className="text-4xl font-bold tracking-tight">Privacy policy</h1>
        <p className="text-sm text-muted-foreground mt-2">Last updated 2026-06-01</p>
        <div className="space-y-5 text-sm leading-relaxed mt-8 text-foreground/90">
          <p>{SITE.legal} ("we", "us") operates the {SITE.brand} platform across {SITE.region}. This policy describes what we collect, why, and the rights you have over your data.</p>
          <h2 className="text-xl font-semibold mt-8">Data we collect</h2>
          <p>We collect contact details you submit (name, phone, email, city), location data you authorise for emergency dispatch, and clinical data necessary to deliver care. Provider crews share live GPS while on shift.</p>
          <h2 className="text-xl font-semibold mt-8">How we use it</h2>
          <p>We use data to dispatch care, run telehealth and screening encounters, issue training certificates, meet compliance obligations, and improve service quality. We do not sell personal data.</p>
          <h2 className="text-xl font-semibold mt-8">Sharing</h2>
          <p>Clinical data is shared only with credentialed clinicians involved in your care. Aggregate, anonymised metrics may be shared with regulators and partners.</p>
          <h2 className="text-xl font-semibold mt-8">Retention</h2>
          <p>We retain clinical records per local healthcare regulations and audit-grade event logs for the duration required by law.</p>
          <h2 className="text-xl font-semibold mt-8">Your rights</h2>
          <p>You may request access, correction, or deletion of personal data by writing to {SITE.contact.email}.</p>
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}