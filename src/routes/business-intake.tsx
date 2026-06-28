import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { BusinessIntakeForm } from "@/components/BusinessIntakeForm";
import { ArrowRight, ShieldCheck } from "lucide-react";

const title = "Talk to sales — onboard your fleet to VeloMed OS";
const desc = "Tell us about your business — legal name, VAT/CR, fleet size, and primary contact. Our team responds within one business day.";

export const Route = createFileRoute("/business-intake")({
  head: () => ({
    meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:url", content: "/business-intake" }, { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" }, { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/business-intake" }],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-4 lg:px-8 py-14 space-y-8">
        <header className="space-y-3">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal flex items-center gap-2"><ShieldCheck className="size-3" /> Business onboarding · website intake</div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Bring your operation onto VeloMed OS</h1>
          <p className="text-muted-foreground">Submit your business details and a VeloMed account executive will reach out. Already booked a call? <Link to="/demo" className="text-teal hover:underline inline-flex items-center gap-1">Skip to demo prep <ArrowRight className="size-3" /></Link></p>
        </header>

        <BusinessIntakeForm mode="public" />

        <p className="text-xs text-muted-foreground">
          We only use these details to contact you about VeloMed OS. See our <Link to="/privacy" className="underline hover:text-foreground">privacy policy</Link>.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}