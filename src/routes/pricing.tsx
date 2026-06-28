import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";
import { CheckCircle2, ArrowRight, ChevronDown, Sparkles, Shield, Zap, Radio, GraduationCap, Stethoscope, Code2, ClipboardCheck, Truck } from "lucide-react";
import { breadcrumbLd, faqLd, jsonld } from "@/components/Jsonld";

const title = "Pricing & plans — VeloMed OS";
const desc = "Transparent per-fleet pricing for ambulance dispatch, telehealth, remote clinics, training and the public REST API. Four tiers from single branch to sovereign.";

type TierId = "starter" | "operator" | "network" | "sovereign";

interface Tier {
  id: TierId;
  eyebrow: string;
  name: string;
  tagline: string;
  monthly: number | null; // USD, null = custom
  units: string;
  seats: string;
  api: string;
  features: string[];
  cta: { label: string; to: string };
  highlight?: boolean;
}

const TIERS: Tier[] = [
  {
    id: "starter",
    eyebrow: "Single branch",
    name: "Starter",
    tagline: "One branch, one crew room, the core console.",
    monthly: 1490,
    units: "Up to 10 units",
    seats: "3 dispatcher seats",
    api: "API sandbox",
    features: [
      "Dispatch console",
      "Provider + patient apps",
      "Live GPS tracking",
      "Fleet & credential basics",
      "Public API sandbox (10k calls/mo)",
      "Email support · 99.5% SLA",
    ],
    cta: { label: "Start a pilot", to: "/demo" },
  },
  {
    id: "operator",
    eyebrow: "Multi-branch",
    name: "Operator",
    tagline: "Several branches under one roof, one chain of command.",
    monthly: 4900,
    units: "Up to 50 units",
    seats: "10 dispatcher seats",
    api: "100k API calls/mo",
    features: [
      "Everything in Starter",
      "Branch → Region hierarchy",
      "Fleet compliance + maintenance",
      "Telehealth add-on ready",
      "Webhooks & SSO (Google)",
      "Priority email support · 99.7% SLA",
    ],
    cta: { label: "Book a demo", to: "/demo" },
  },
  {
    id: "network",
    eyebrow: "Most chosen",
    name: "Network",
    tagline: "Regional operators running multi-tenant, multi-country.",
    monthly: 12500,
    units: "Up to 200 units",
    seats: "Unlimited seats",
    api: "1M API calls/mo",
    features: [
      "Everything in Operator",
      "Full Org → Branch → Region → Team scoping",
      "Training & Certification LMS",
      "Remote clinic & screening modules",
      "SAML SSO + role privileges matrix",
      "24/7 priority response · 99.9% SLA",
    ],
    cta: { label: "Book a demo", to: "/demo" },
    highlight: true,
  },
  {
    id: "sovereign",
    eyebrow: "Regional / national",
    name: "Sovereign",
    tagline: "Dedicated cluster, in-country residency, named support.",
    monthly: null,
    units: "Unlimited units",
    seats: "Unlimited seats",
    api: "Committed throughput",
    features: [
      "Everything in Network",
      "Dedicated cluster (single-tenant)",
      "In-country data residency",
      "Custom SLA & DR/BCP runbook",
      "On-prem / private cloud option",
      "24/7 named support · 99.99% SLA",
    ],
    cta: { label: "Talk to sales", to: "/contact" },
  },
];

const ADDONS = [
  { icon: Stethoscope, name: "Remote Clinic Pods", unit: "per pod / month", price: "$ 850" },
  { icon: Truck, name: "Ambulance Rental Marketplace", unit: "of GMV", price: "6 %" },
  { icon: GraduationCap, name: "Training & Certification LMS", unit: "per learner / year", price: "$ 38" },
  { icon: Code2, name: "Public API — metered overage", unit: "per 1,000 calls (beyond plan)", price: "$ 0.40" },
  { icon: ClipboardCheck, name: "Compliance & Credential Vault", unit: "per branch / month", price: "$ 240" },
  { icon: Shield, name: "Insurance Claims Concierge", unit: "per recovered claim", price: "4 %" },
];

const ALWAYS_INCLUDED = [
  "Dispatch console",
  "Provider + patient apps",
  "Public REST API + Swagger",
  "Audit log",
  "RLS multi-tenant",
  "Encrypted at rest & in transit",
];

const MATRIX_ROWS: Array<{ label: string; values: [string, string, string, string] }> = [
  { label: "Ambulance / mobile units",  values: ["10",            "50",                 "200",                "Unlimited"] },
  { label: "Dispatcher seats",          values: ["3",             "10",                 "Unlimited",          "Unlimited"] },
  { label: "Branches",                  values: ["1",             "Up to 8",            "Unlimited",          "Unlimited"] },
  { label: "Hierarchy depth",           values: ["Branch",        "Branch → Region",    "Org → Branch → Region → Team", "Custom"] },
  { label: "Public API quota",          values: ["10k / mo",      "100k / mo",          "1M / mo",            "Committed"] },
  { label: "Telehealth module",         values: ["—",             "Add-on",             "Included",           "Included"] },
  { label: "Training LMS",              values: ["—",             "Add-on",             "Included",           "Included"] },
  { label: "SSO",                       values: ["Google",        "Google",             "Google + SAML",      "SAML + custom IdP"] },
  { label: "Uptime SLA",                values: ["99.5 %",        "99.7 %",             "99.9 %",             "99.99 %"] },
  { label: "Support",                   values: ["Email",         "Priority email",     "24/7 priority",      "24/7 named team"] },
  { label: "Data residency",            values: ["Regional",      "Regional",           "Region of choice",   "In-country / on-prem"] },
];

const FAQS = [
  { q: "Can we change plans mid-contract?", a: "Yes — upgrade any time and we prorate to the day. Downgrades take effect at the next renewal so you keep paid features through the period." },
  { q: "Which currencies do you bill in?", a: "List prices are USD for clarity. We invoice in SAR, AED, EGP, USD or EUR — VAT is added per your tax jurisdiction (15% KSA, 5% UAE, etc.)." },
  { q: "Where is our data hosted?", a: "Network plans pick a region (EU, KSA, UAE). Sovereign customers get an in-country dedicated cluster or on-prem deployment with a signed DPA." },
  { q: "What does the SLA actually cover?", a: "Dispatch console + provider/patient APIs. Credits apply if monthly uptime drops below tier target; full SLO matrix is in the MSA." },
  { q: "Is there a free pilot?", a: "Starter and Operator include a 30-day scoped pilot with up to 5 units and a guided onboarding session — no card required, cancel before day 30." },
  { q: "How is the public API priced?", a: "Every plan includes a quota. Beyond that, overage is $0.40 per 1,000 calls. Committed throughput and dedicated rate limits are available on Sovereign." },
];

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:url", content: "/pricing" }, { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" }, { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
    scripts: [
      { type: "application/ld+json", children: jsonld(breadcrumbLd([
        { name: "Home", href: "/" }, { name: "Pricing", href: "/pricing" },
      ])) },
      { type: "application/ld+json", children: jsonld(faqLd(FAQS)) },
    ],
  }),
  component: Pricing,
});

const fmt = (n: number) => "$" + n.toLocaleString("en-US");

function Pricing() {
  const [period, setPeriod] = useState<"monthly" | "annual">("annual");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const priceFor = (t: Tier) => {
    if (t.monthly === null) return { big: "Custom", small: "annual contract" };
    if (period === "monthly") return { big: fmt(t.monthly), small: "per month" };
    // annual = save 2 months
    const annual = t.monthly * 10;
    return { big: fmt(Math.round(annual / 12)), small: `per month · billed annually (${fmt(annual)})` };
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <EmergencyBanner />

      {/* HERO */}
      <header className="max-w-[1280px] mx-auto px-4 lg:px-8 pt-16 pb-10 text-center">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-action mb-3">Pricing · v1</div>
        <h1 className="text-4xl lg:text-6xl font-bold tracking-tight max-w-3xl mx-auto">
          Priced against your <span className="text-action">fleet</span>, not your seats.
        </h1>
        <p className="text-muted-foreground mt-5 max-w-2xl mx-auto text-lg">
          One platform — dispatch, provider, patient, API, training, telehealth. Four tiers from a single branch to a sovereign deployment.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-1 p-1 rounded-full mt-8 border border-hairline bg-panel">
          {(["monthly", "annual"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-5 py-2 rounded-full mono text-[11px] uppercase tracking-widest transition-colors ${
                period === p ? "bg-action text-action-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "monthly" ? "Monthly" : "Annual · save 2 months"}
            </button>
          ))}
        </div>
        <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-3">
          Prices in USD · invoiced in SAR / AED / EGP / EUR · VAT added per jurisdiction
        </div>
      </header>

      {/* TIERS */}
      <section className="max-w-[1400px] mx-auto px-4 lg:px-8 pb-16">
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline">
          {TIERS.map((t) => {
            const price = priceFor(t);
            return (
              <div
                key={t.id}
                className={`relative bg-panel p-6 flex flex-col ${t.highlight ? "ring-1 ring-action/60 bg-panel-elevated" : ""}`}
              >
                {t.highlight && (
                  <div className="absolute -top-px left-0 right-0 bg-action text-action-foreground mono text-[10px] uppercase tracking-[0.2em] text-center py-1">
                    <Sparkles className="inline size-3 -mt-0.5 mr-1" /> Most chosen
                  </div>
                )}
                <div className={`mono text-[10px] uppercase tracking-widest text-action ${t.highlight ? "mt-6" : ""}`}>{t.eyebrow}</div>
                <div className="text-2xl font-bold mt-2">{t.name}</div>
                <div className="text-sm text-muted-foreground mt-1.5 min-h-[40px]">{t.tagline}</div>

                <div className="mt-5 pt-5 border-t border-hairline">
                  <div className="text-4xl font-bold mono tracking-tight">{price.big}</div>
                  <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-1.5">{price.small}</div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 text-[11px]">
                  <div className="bg-background/40 border border-hairline rounded-md px-2 py-1.5">
                    <div className="mono text-[9px] uppercase tracking-widest text-muted-foreground">Units</div>
                    <div className="font-semibold mt-0.5">{t.units.replace("Up to ", "≤ ").replace("Unlimited", "∞")}</div>
                  </div>
                  <div className="bg-background/40 border border-hairline rounded-md px-2 py-1.5">
                    <div className="mono text-[9px] uppercase tracking-widest text-muted-foreground">Seats</div>
                    <div className="font-semibold mt-0.5">{t.seats.replace("Unlimited", "∞").replace(" dispatcher seats", "")}</div>
                  </div>
                  <div className="bg-background/40 border border-hairline rounded-md px-2 py-1.5">
                    <div className="mono text-[9px] uppercase tracking-widest text-muted-foreground">API</div>
                    <div className="font-semibold mt-0.5">{t.api.replace(" API calls/mo", "").replace("Committed throughput", "Committed").replace("API sandbox", "Sandbox")}</div>
                  </div>
                </div>

                <ul className="mt-5 space-y-2 flex-1">
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-2 text-sm">
                      <CheckCircle2 className="size-4 text-stable shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={t.cta.to}
                  className={`mt-6 inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-md mono text-[11px] uppercase tracking-widest transition-colors ${
                    t.highlight
                      ? "bg-action text-action-foreground hover:opacity-90"
                      : "border border-hairline hover:bg-panel-elevated"
                  }`}
                >
                  {t.cta.label} <ArrowRight className="size-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ALWAYS INCLUDED */}
      <section className="border-y border-hairline bg-panel/40">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-8">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">In every plan</div>
            <div className="flex flex-wrap gap-2">
              {ALWAYS_INCLUDED.map((x) => (
                <span key={x} className="text-xs px-2.5 py-1 rounded-full border border-hairline bg-background/40 inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-3 text-stable" /> {x}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ADD-ONS */}
      <section className="max-w-[1280px] mx-auto px-4 lg:px-8 py-16">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-action">Add-ons</div>
            <h2 className="text-3xl font-bold tracking-tight mt-2">Bolt on what you need</h2>
            <p className="text-muted-foreground mt-2 max-w-xl">Modular pricing for capabilities outside the core console — pay only for what you switch on.</p>
          </div>
          <Link to="/contact" className="mono text-[11px] uppercase tracking-widest text-action hover:underline">Get a bundle quote →</Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-hairline border border-hairline rounded-xl overflow-hidden">
          {ADDONS.map((a) => (
            <div key={a.name} className="bg-panel p-5 flex items-start gap-4">
              <div className="size-10 rounded-md bg-background/50 border border-hairline grid place-items-center shrink-0">
                <a.icon className="size-5 text-action" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{a.name}</div>
                <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-1">{a.unit}</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold mono">{a.price}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* COMPARISON MATRIX */}
      <section className="border-t border-hairline bg-panel/30">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-16">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-action">Comparison</div>
          <h2 className="text-3xl font-bold tracking-tight mt-2">Tier by tier, line by line</h2>
          <div className="mt-6 overflow-x-auto rounded-xl border border-hairline">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-panel">
                  <th className="text-left p-4 mono text-[10px] uppercase tracking-widest text-muted-foreground sticky left-0 bg-panel">Capability</th>
                  {TIERS.map((t) => (
                    <th key={t.id} className={`text-left p-4 mono text-[10px] uppercase tracking-widest ${t.highlight ? "text-action" : "text-muted-foreground"}`}>
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX_ROWS.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? "bg-background/30" : "bg-background/10"}>
                    <td className="p-4 font-medium sticky left-0 bg-inherit">{row.label}</td>
                    {row.values.map((v, j) => (
                      <td key={j} className={`p-4 ${TIERS[j].highlight ? "text-foreground" : "text-muted-foreground"}`}>
                        {v === "—" ? <span className="text-muted-foreground/50">—</span> : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* API PRICING */}
      <section className="max-w-[1280px] mx-auto px-4 lg:px-8 py-16">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-action">Public API</div>
            <h2 className="text-3xl font-bold tracking-tight mt-2">Build on the same API our apps use</h2>
          </div>
          <Link to="/api-reference" className="mono text-[11px] uppercase tracking-widest text-action hover:underline">Open API reference →</Link>
        </div>
        <div className="grid md:grid-cols-3 gap-px bg-hairline border border-hairline rounded-xl overflow-hidden">
          {[
            { name: "Sandbox", price: "Free", desc: "10,000 calls/mo · rate-limited · non-production data", icon: Code2 },
            { name: "Metered", price: "$0.40 / 1k", desc: "After plan quota · all production endpoints · webhooks included", icon: Zap },
            { name: "Committed", price: "Custom", desc: "Reserved throughput · dedicated rate limits · written SLO", icon: Radio },
          ].map((p) => (
            <div key={p.name} className="bg-panel p-6">
              <p.icon className="size-5 text-action" />
              <div className="text-lg font-semibold mt-3">{p.name}</div>
              <div className="text-3xl font-bold mono mt-2">{p.price}</div>
              <div className="text-sm text-muted-foreground mt-2">{p.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-hairline bg-panel/30">
        <div className="max-w-[900px] mx-auto px-4 lg:px-8 py-16">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-action">FAQ</div>
          <h2 className="text-3xl font-bold tracking-tight mt-2">Questions buyers actually ask</h2>
          <div className="mt-6 divide-y divide-hairline border border-hairline rounded-xl overflow-hidden bg-panel">
            {FAQS.map((f, i) => {
              const open = openFaq === i;
              return (
                <button
                  key={f.q}
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="w-full text-left p-5 flex gap-4 items-start hover:bg-panel-elevated transition-colors"
                  aria-expanded={open}
                >
                  <div className="flex-1">
                    <div className="font-semibold">{f.q}</div>
                    {open && <div className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.a}</div>}
                  </div>
                  <ChevronDown className={`size-4 text-muted-foreground shrink-0 mt-1 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="border-t border-hairline">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-16 grid md:grid-cols-2 gap-px bg-hairline border border-hairline rounded-xl overflow-hidden">
          <div className="bg-panel p-8">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-action">Pilot</div>
            <h3 className="text-2xl font-bold mt-2">Book a scoped demo</h3>
            <p className="text-muted-foreground mt-2 text-sm">45 minutes. We map your fleet, branches and dispatch flow onto the console live.</p>
            <Link to="/demo" className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-action text-action-foreground mono text-[11px] uppercase tracking-widest">
              Book demo <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="bg-panel p-8">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-action">Procurement</div>
            <h3 className="text-2xl font-bold mt-2">Talk to sales</h3>
            <p className="text-muted-foreground mt-2 text-sm">Sovereign, RFP responses, security questionnaires, data residency — we'll route you to the right team.</p>
            <Link to="/contact" className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-hairline mono text-[11px] uppercase tracking-widest hover:bg-panel-elevated">
              Contact sales <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}