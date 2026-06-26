import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { SITE } from "@/lib/site-config";
import { breadcrumbLd, jsonld } from "@/components/Jsonld";

const title = "Request a demo — VeloMed OS";
const desc = "See VeloMed OS — dispatch console, provider and patient apps, fleet compliance and public API — scoped against your fleet and cities.";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  organization: z.string().trim().min(2).max(200),
  role: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional(),
  city: z.string().trim().max(120).optional(),
  message: z.string().trim().max(2000).optional(),
});

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:url", content: "/demo" }, { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" }, { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/demo" }],
    scripts: [{ type: "application/ld+json", children: jsonld(breadcrumbLd([
      { name: "Home", href: "/" }, { name: "Request a demo", href: "/demo" },
    ])) }],
  }),
  component: Demo,
});

function Demo() {
  const [f, setF] = useState({ name: "", organization: "", role: "", email: "", phone: "", city: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ reference_code: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(f);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check your inputs"); return; }
    setBusy(true);
    try {
      const message = [
        f.organization && `Organization: ${f.organization}`,
        f.role && `Role: ${f.role}`,
        f.message,
      ].filter(Boolean).join("\n");
      const res = await fetch("/api/public/v1/web_intake", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "general", name: f.name, email: f.email, phone: f.phone || null, city: f.city || null, message }),
      });
      const data = await res.json() as { ok?: boolean; reference_code?: string; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Submission failed");
      setDone({ reference_code: data.reference_code! });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <section className="max-w-xl mx-auto px-4 py-20">
          <div className="rounded-xl border border-stable/40 bg-stable/5 p-8 text-center">
            <CheckCircle2 className="size-12 text-stable mx-auto mb-4" />
            <h1 className="text-2xl font-bold">Demo request received</h1>
            <p className="text-sm text-muted-foreground mt-2">A VeloMed team member will follow up within one business day to schedule your walk-through.</p>
            <div className="mt-6 mono text-xl font-bold">{done.reference_code}</div>
            <Link to="/" className="mt-6 inline-flex items-center gap-2 mono text-[11px] uppercase tracking-widest text-action">Back to home <ArrowRight className="size-3" /></Link>
          </div>
        </section>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <EmergencyBanner />
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 pt-16 pb-16 grid lg:grid-cols-2 gap-12">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-action mb-2">Request access</div>
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">See VeloMed OS, scoped to your fleet.</h1>
          <p className="text-muted-foreground mt-4 max-w-md text-lg">A 30-minute walk-through of dispatch, provider, patient and API surfaces with your operating cities pre-loaded.</p>
          <ul className="mt-8 space-y-3 text-sm">
            {["Live dispatch console with road-based ETA", "Provider app on a real phone", "Public REST API & webhooks", "Compliance gating against your fleet"].map((b) => (
              <li key={b} className="flex gap-2"><CheckCircle2 className="size-4 text-stable shrink-0 mt-0.5" />{b}</li>
            ))}
          </ul>
        </div>
        <form onSubmit={submit} className="rounded-xl border border-hairline bg-panel p-6 space-y-4">
          <Row label="Full name" required><input required value={f.name} onChange={(e)=>setF({...f,name:e.target.value})} className="w-full h-10 px-3 rounded-md bg-background border border-hairline text-sm" /></Row>
          <Row label="Organization" required><input required value={f.organization} onChange={(e)=>setF({...f,organization:e.target.value})} className="w-full h-10 px-3 rounded-md bg-background border border-hairline text-sm" /></Row>
          <Row label="Role"><input value={f.role} onChange={(e)=>setF({...f,role:e.target.value})} placeholder="e.g. Operations Director" className="w-full h-10 px-3 rounded-md bg-background border border-hairline text-sm" /></Row>
          <div className="grid grid-cols-2 gap-3">
            <Row label="Work email" required><input required type="email" value={f.email} onChange={(e)=>setF({...f,email:e.target.value})} className="w-full h-10 px-3 rounded-md bg-background border border-hairline text-sm" /></Row>
            <Row label="Phone"><input value={f.phone} onChange={(e)=>setF({...f,phone:e.target.value})} className="w-full h-10 px-3 rounded-md bg-background border border-hairline text-sm" /></Row>
          </div>
          <Row label="Primary city">
            <select value={f.city} onChange={(e)=>setF({...f,city:e.target.value})} className="w-full h-10 px-3 rounded-md bg-background border border-hairline text-sm">
              <option value="">Select…</option>
              {SITE.cities.map((c) => <option key={c.slug} value={c.name}>{c.name}, {c.country}</option>)}
              <option value="other">Other</option>
            </select>
          </Row>
          <Row label="What would you like to see?"><textarea rows={4} value={f.message} onChange={(e)=>setF({...f,message:e.target.value})} className="w-full px-3 py-2 rounded-md bg-background border border-hairline text-sm" /></Row>
          <button disabled={busy} className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-emergency text-emergency-foreground mono text-xs uppercase tracking-widest font-bold disabled:opacity-50">{busy ? "Submitting…" : "Request a demo"} <ArrowRight className="size-3.5" /></button>
          <p className="text-[11px] text-muted-foreground text-center">For emergencies, use <Link to="/contact" className="text-emergency underline">the emergency form</Link> instead.</p>
        </form>
      </section>
      <SiteFooter />
    </div>
  );
}

function Row({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}{required && <span className="text-emergency"> *</span>}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}