import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";
import { breadcrumbLd, faqLd, jsonld } from "@/components/Jsonld";
import { CheckCircle2, MinusCircle, ArrowRight } from "lucide-react";

const title = "Ambulance dispatch software compared — VeloMed OS vs AIM, Traumasoft & peers";
const desc = "How VeloMed OS compares to legacy ambulance dispatch software. Branch-aware OS, open REST API, live multi-level mapping — built for multi-branch operators.";

const ROWS: Array<{ feature: string; velomed: string; aim: string; traumasoft: string }> = [
  { feature: "Branch-aware hierarchy (Org → Branch → Region → Team → Case)", velomed: "Native", aim: "Limited", traumasoft: "Partial" },
  { feature: "Three-level live map (Network · Region · Team)", velomed: "Yes", aim: "No", traumasoft: "Single fleet view" },
  { feature: "Public REST API (OpenAPI 3.1)", velomed: "Documented + scoped keys", aim: "Partner-only", traumasoft: "Limited" },
  { feature: "Webhooks for incidents, trips, compliance", velomed: "Yes", aim: "No", traumasoft: "Partial" },
  { feature: "Fleet compliance gates dispatch", velomed: "Automatic", aim: "Manual", traumasoft: "Manual" },
  { feature: "Remote / mobile clinics & telehealth", velomed: "Built-in", aim: "Add-on", traumasoft: "No" },
  { feature: "Training & certification module", velomed: "Built-in", aim: "No", traumasoft: "No" },
  { feature: "5-second GPS upstream from crews", velomed: "Yes", aim: "30s typical", traumasoft: "10s typical" },
];

const FAQS = [
  { q: "What is the best ambulance dispatch software for multi-branch operators?", a: "VeloMed OS is purpose-built around a branch hierarchy: every queue, permission, report and alert is scoped Organisation → Branch → Region → Team → Case. Legacy systems like AIM and Traumasoft were designed as single-fleet consoles and bolt multi-branch on top." },
  { q: "Does VeloMed OS expose a public API?", a: "Yes. The same documented REST API (OpenAPI 3.1) powers the dispatch console, provider app and patient app. Scoped API keys and webhooks are first-class — most legacy ambulance dispatch software keeps integrations partner-gated." },
  { q: "How does VeloMed OS compare to AIM and Traumasoft on price?", a: "We price against fleet size, cities and SLAs — not seats. Operators usually consolidate dispatch, fleet compliance, telehealth and training onto VeloMed OS, replacing two or three legacy tools." },
];

export const Route = createFileRoute("/resources/comparison")({
  head: () => ({
    meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:url", content: "/resources/comparison" }, { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" }, { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/resources/comparison" }],
    scripts: [
      { type: "application/ld+json", children: jsonld(breadcrumbLd([
        { name: "Home", href: "/" }, { name: "Resources", href: "/resources" }, { name: "Comparison guide", href: "/resources/comparison" },
      ])) },
      { type: "application/ld+json", children: jsonld(faqLd(FAQS)) },
    ],
  }),
  component: ComparisonGuide,
});

function Cell({ value }: { value: string }) {
  const positive = /^(yes|native|built-in|automatic|documented)/i.test(value);
  const negative = /^(no|limited|partner-only|manual|partial)/i.test(value);
  return (
    <td className="px-4 py-3 text-sm align-top">
      <div className="flex items-start gap-2">
        {positive ? <CheckCircle2 className="size-4 text-stable shrink-0 mt-0.5" /> : negative ? <MinusCircle className="size-4 text-muted-foreground shrink-0 mt-0.5" /> : null}
        <span>{value}</span>
      </div>
    </td>
  );
}

function ComparisonGuide() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <EmergencyBanner />
      <article className="max-w-[1100px] mx-auto px-4 lg:px-8 pt-16 pb-20">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-action mb-2">Comparison guide</div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight max-w-3xl">Ambulance dispatch software, compared.</h1>
        <p className="text-muted-foreground mt-4 max-w-2xl text-lg">A straight read on how VeloMed OS stacks up against the established names — AIM EMS, Traumasoft and other ambulance dispatch platforms — for multi-branch operators who need one canvas across many cities.</p>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">Feature matrix</h2>
          <p className="text-sm text-muted-foreground mt-2">A snapshot of how each platform handles the things multi-branch operators actually buy on.</p>
          <div className="mt-6 overflow-x-auto rounded-xl border border-hairline">
            <table className="w-full text-left bg-panel">
              <thead className="bg-panel-elevated">
                <tr>
                  <th className="px-4 py-3 mono text-[10px] uppercase tracking-widest text-muted-foreground">Capability</th>
                  <th className="px-4 py-3 mono text-[10px] uppercase tracking-widest text-action">VeloMed OS</th>
                  <th className="px-4 py-3 mono text-[10px] uppercase tracking-widest text-muted-foreground">AIM EMS</th>
                  <th className="px-4 py-3 mono text-[10px] uppercase tracking-widest text-muted-foreground">Traumasoft</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {ROWS.map((r) => (
                  <tr key={r.feature}>
                    <td className="px-4 py-3 text-sm font-medium">{r.feature}</td>
                    <Cell value={r.velomed} />
                    <Cell value={r.aim} />
                    <Cell value={r.traumasoft} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12 grid md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-hairline bg-panel p-6">
            <h2 className="text-xl font-semibold">When VeloMed OS wins</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc pl-5">
              <li>You run more than one branch and need scoped queues, reports and roles out of the box.</li>
              <li>You need a documented public API for partners, hospitals or government dashboards.</li>
              <li>You want fleet compliance to automatically gate dispatch instead of being a checklist.</li>
              <li>You operate ambulances and clinics and screening — and want one platform.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-hairline bg-panel p-6">
            <h2 className="text-xl font-semibold">When a legacy suite still fits</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc pl-5">
              <li>You're a single-branch operator with deep US billing-clearinghouse integrations.</li>
              <li>You have an existing on-prem deployment with regulator-locked workflows.</li>
              <li>You don't need an open API or telehealth, screening and training under one roof.</li>
            </ul>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">FAQ</h2>
          <div className="mt-6 divide-y divide-hairline rounded-xl border border-hairline bg-panel">
            {FAQS.map((f) => (
              <details key={f.q} className="p-5 group">
                <summary className="cursor-pointer font-semibold list-none flex items-center justify-between">
                  <span>{f.q}</span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-xl border border-hairline bg-panel p-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="mono text-[10px] uppercase tracking-widest text-action">See it on your fleet</div>
            <h2 className="text-2xl font-semibold mt-1">Walk through VeloMed OS with your team.</h2>
          </div>
          <Link to="/demo" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-action text-action-foreground mono text-[11px] uppercase tracking-widest font-bold">Request a demo <ArrowRight className="size-3" /></Link>
        </section>
      </article>
      <SiteFooter />
    </div>
  );
}