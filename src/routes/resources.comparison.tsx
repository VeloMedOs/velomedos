import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";
import { breadcrumbLd, faqLd, jsonld } from "@/components/Jsonld";
import { CheckCircle2, MinusCircle, ArrowRight } from "lucide-react";

const title = "Ambulance dispatch software: VeloMed OS vs ESO Suite (2026)";
const desc = "A side-by-side comparison of VeloMed OS and ESO Suite as ambulance dispatch software. Branch-aware Network → Region → Crew drill-down for multi-branch regional operators vs a legacy single-agency suite.";

const ROWS: Array<{ feature: string; velomed: string; eso: string }> = [
  { feature: "Network → Region → Crew drill-down", velomed: "Native — every queue, map and report scopes by branch hierarchy", eso: "Single-agency console; multi-branch handled as separate tenants" },
  { feature: "Multi-tenant hierarchy for regional operators", velomed: "Org → Branch → Region → Team → Case, with scoped roles and SLAs", eso: "Agency-first model; cross-agency rollups require ESO Analytics add-on" },
  { feature: "Live three-level operations map", velomed: "Network view, Region view and Crew view from one canvas", eso: "Single fleet map per agency" },
  { feature: "Public REST API (OpenAPI 3.1)", velomed: "Documented, scoped keys, self-serve", eso: "Partner-gated integrations" },
  { feature: "Webhooks for incidents, trips, compliance", velomed: "First-class", eso: "Limited" },
  { feature: "Fleet compliance gates dispatch", velomed: "Automatic — expired licence or service blocks assignment", eso: "Tracked, but enforcement is manual" },
  { feature: "Remote / mobile clinics & telehealth", velomed: "Built-in", eso: "Separate product line" },
  { feature: "Training & certification module", velomed: "Built-in, ties to crew compliance", eso: "Separate (ESO ICEMA / training products)" },
  { feature: "Crew GPS upstream cadence", velomed: "5 seconds", eso: "10–30 seconds typical" },
  { feature: "Designed for", velomed: "Multi-branch regional operators across GCC, KSA, EU", eso: "US single-agency EMS and fire" },
];

const FAQS = [
  { q: "What is the best ambulance dispatch software for multi-branch operators?", a: "If you run more than one branch across cities or regions, VeloMed OS is built around the hierarchy you already operate: every queue, permission, map view, SLA and report is scoped Organisation → Branch → Region → Team → Case. ESO Suite is excellent ambulance dispatch software for a single US agency, but multi-branch consolidation in ESO is typically handled by running separate tenants and joining the data downstream in ESO Analytics." },
  { q: "How is VeloMed OS different from ESO Suite?", a: "ESO Suite is a mature single-agency stack (ePCR, dispatch, billing, fire). VeloMed OS is a branch-aware operations platform — the same console drills from a Network map of every region, down to a Region map of active crews, down to a Crew view of one ambulance and one case. That Network → Region → Crew drill-down is the primary differentiator for groups operating across multiple cities or contracts." },
  { q: "Does VeloMed OS expose a public API?", a: "Yes. The same documented REST API (OpenAPI 3.1) powers the dispatch console, provider app and patient app, with scoped API keys and webhooks. Most legacy ambulance dispatch software — including ESO — keeps integrations partner-gated." },
  { q: "Can VeloMed OS replace ESO Suite end-to-end?", a: "For dispatch, fleet compliance, telehealth clinics, training and patient app, yes — on one platform. For US-specific ePCR and clearinghouse billing depth, ESO still leads; we partner with regional billing vendors instead of rebuilding US clearinghouse coverage." },
  { q: "Is VeloMed OS priced per seat like ESO?", a: "No. VeloMed OS is priced against fleet size, branches and SLAs — not per dispatcher seat — so adding a call-centre agent or a paramedic does not change the bill." },
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
  const positive = /^(yes|native|built-in|automatic|documented|first-class|5\s|org)/i.test(value);
  const negative = /^(no|limited|partner-gated|partner-only|manual|partial|single|separate|tracked|agency-first|10|30)/i.test(value);
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
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-action mb-2">Comparison guide · 2026</div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight max-w-3xl">Ambulance dispatch software: VeloMed OS vs ESO Suite.</h1>
        <p className="text-muted-foreground mt-4 max-w-2xl text-lg">ESO Suite is the reference stack for a single US EMS agency. VeloMed OS is built for the operator running many branches across many cities — with a Network → Region → Crew drill-down as the primary canvas. Here is how the two compare on the things multi-branch teams actually buy on.</p>

        <section className="mt-10 rounded-xl border border-hairline bg-panel p-6">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-action mb-2">The differentiator</div>
          <h2 className="text-2xl font-semibold tracking-tight">Network → Region → Crew, in one console.</h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-3xl">VeloMed OS treats your branch tree as a first-class object. The dispatcher opens the <strong>Network</strong> map of every region you operate, drills into a <strong>Region</strong> to see live crews and queues, then opens a <strong>Crew</strong> view for one ambulance and one case — without leaving the console or swapping tenants. Legacy ambulance dispatch software, including ESO Suite, treats each agency as a separate world and asks Analytics to join them downstream.</p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">Feature matrix</h2>
          <p className="text-sm text-muted-foreground mt-2">How VeloMed OS and ESO Suite handle the capabilities multi-branch operators evaluate first.</p>
          <div className="mt-6 overflow-x-auto rounded-xl border border-hairline">
            <table className="w-full text-left bg-panel">
              <thead className="bg-panel-elevated">
                <tr>
                  <th className="px-4 py-3 mono text-[10px] uppercase tracking-widest text-muted-foreground">Capability</th>
                  <th className="px-4 py-3 mono text-[10px] uppercase tracking-widest text-action">VeloMed OS</th>
                  <th className="px-4 py-3 mono text-[10px] uppercase tracking-widest text-muted-foreground">ESO Suite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {ROWS.map((r) => (
                  <tr key={r.feature}>
                    <td className="px-4 py-3 text-sm font-medium">{r.feature}</td>
                    <Cell value={r.velomed} />
                    <Cell value={r.eso} />
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
              <li>You run more than one branch and need a Network → Region → Crew drill-down out of the box.</li>
              <li>You need a documented public REST API for hospitals, partners or government dashboards.</li>
              <li>You want fleet compliance to automatically gate dispatch, not sit in a separate checklist.</li>
              <li>You operate ambulances, mobile clinics, screening and training and want one platform.</li>
              <li>You're a GCC, KSA or EU operator and want a vendor that ships PDPL/HIPAA-aware defaults.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-hairline bg-panel p-6">
            <h2 className="text-xl font-semibold">When ESO Suite still fits</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc pl-5">
              <li>You're a single US EMS agency with deep clearinghouse billing requirements.</li>
              <li>You're standardised on NEMSIS-compliant ePCR with ESO's existing hospital integrations.</li>
              <li>You don't operate across multiple branches or regions and don't need a public API.</li>
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