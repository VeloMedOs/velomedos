import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { SITE } from "@/lib/site-config";

const title = "Terms of service — VeloMed OS";
const desc = "Terms governing use of the VeloMed OS public website, REST API, and operator and patient applications.";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:url", content: "/terms" }, { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: Terms,
});

function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <article className="max-w-[800px] mx-auto px-4 lg:px-8 py-16">
        <h1 className="text-4xl font-bold tracking-tight">Terms of service</h1>
        <p className="text-sm text-muted-foreground mt-2">Last updated 2026-06-01</p>
        <div className="space-y-5 text-sm leading-relaxed mt-8 text-foreground/90">
          <p>These terms govern your use of {SITE.brand} operated by {SITE.legal}. By accessing the website or any application, you agree to these terms.</p>
          <h2 className="text-xl font-semibold mt-8">Medical disclaimer</h2>
          <p><strong className="text-emergency">For life-threatening emergencies, call your local emergency number directly.</strong> The {SITE.brand} contact channels are for dispatchable non-911 requests inside our operating regions and do not replace public emergency services.</p>
          <h2 className="text-xl font-semibold mt-8">Acceptable use</h2>
          <p>You agree not to misuse the platform, attempt unauthorised access, or interfere with the integrity of dispatch and clinical workflows.</p>
          <h2 className="text-xl font-semibold mt-8">API use</h2>
          <p>Use of the public REST API is governed by per-key scopes and rate limits. Excessive or abusive use may result in key revocation.</p>
          <h2 className="text-xl font-semibold mt-8">Liability</h2>
          <p>To the maximum extent permitted by law, {SITE.legal} is not liable for indirect or consequential damages arising from use of the platform.</p>
          <h2 className="text-xl font-semibold mt-8">Contact</h2>
          <p>Questions about these terms: {SITE.contact.email}.</p>
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}