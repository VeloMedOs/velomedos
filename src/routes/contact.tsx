import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";
import { Crosshair, Loader2, CheckCircle2, AlertTriangle, Copy } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Request help — VeloMed OS" },
      { name: "description", content: "Request an ambulance, a clinic appointment, mobile screening, rental or training. Non-911 requests routed live to our call centre." },
      { property: "og:title", content: "VeloMed OS — Request help" },
      { property: "og:description", content: "Submit a request: emergency, clinic, screening, rental or training." },
    ],
  }),
  component: Contact,
});

type Kind = "emergency" | "clinic" | "screening" | "rental" | "training" | "general";

const formSchema = z.object({
  name: z.string().trim().min(2, "Name required").max(120),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional(),
  address: z.string().trim().max(500).optional(),
  message: z.string().trim().max(2000).optional(),
});

function Contact() {
  const [kind, setKind] = useState<Kind>("emergency");
  const [severity, setSeverity] = useState<"code_red"|"code_yellow"|"routine">("code_yellow");
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "", address: "", message: "", service: "" });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ kind: string; reference_code: string } | null>(null);

  function locate() {
    if (!navigator.geolocation) return toast.error("Geolocation unavailable");
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); toast.success("Location locked"); },
      (err) => toast.error(err.message),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check your inputs"); return; }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        kind,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        city: form.city.trim() || null,
        address: form.address.trim() || null,
        message: form.message.trim() || null,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      };
      if (kind === "emergency") { body.severity = severity; body.symptoms = form.message.trim() || null; }
      else { body.service = form.service.trim() || null; }
      const res = await fetch("/api/public/v1/web_intake", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json() as { ok?: boolean; reference_code?: string; kind?: string; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Submission failed");
      setResult({ kind: data.kind ?? kind, reference_code: data.reference_code! });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const isEmergency = result.kind === "emergency";
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <EmergencyBanner />
        <section className="max-w-xl mx-auto px-4 py-20">
          <div className="rounded-xl border border-stable/40 bg-stable/5 p-8 text-center">
            <CheckCircle2 className="size-12 text-stable mx-auto mb-4" />
            <h1 className="text-2xl font-bold">{isEmergency ? "Dispatch received" : "Request received"}</h1>
            <p className="text-sm text-muted-foreground mt-2">{isEmergency ? "Our call centre is reviewing your request now. A dispatcher will be in touch on the number you provided." : "A team member will follow up shortly to confirm details."}</p>
            <div className="mt-6 rounded-md border border-hairline bg-panel p-4 flex items-center justify-between">
              <div>
                <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Reference</div>
                <div className="mono text-xl font-bold mt-0.5">{result.reference_code}</div>
              </div>
              <button onClick={() => { navigator.clipboard.writeText(result.reference_code); toast.success("Copied"); }} className="px-3 h-9 rounded-md border border-hairline mono text-[10px] uppercase tracking-widest inline-flex items-center gap-1.5">
                <Copy className="size-3.5" /> Copy
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">Keep this code to check your request status with our call centre.</p>
            <div className="mt-8 flex flex-wrap gap-2 justify-center">
              <Link to="/" className="px-4 h-10 inline-flex items-center rounded-md border border-hairline mono text-[10px] uppercase tracking-widest">Back home</Link>
              <Link to="/auth" className="px-4 h-10 inline-flex items-center rounded-md bg-action text-action-foreground mono text-[10px] uppercase tracking-widest">Sign in to track</Link>
            </div>
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
      <section className="max-w-3xl mx-auto px-4 lg:px-8 pt-12 pb-20">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2">Request</div>
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Tell us what you need.</h1>
        <p className="text-muted-foreground mt-2 text-sm max-w-xl">Emergency requests route to the dispatch console. Clinic, screening, rental and training requests become a lead our team picks up the same day.</p>

        <div className="mt-6 rounded-md border border-emergency/40 bg-emergency/5 p-4 flex gap-3">
          <AlertTriangle className="size-5 text-emergency shrink-0 mt-0.5" />
          <div className="text-sm">
            <strong className="text-emergency">Life-threatening emergencies:</strong> call your local emergency number directly. This form is for dispatchable non-911 requests inside our operating regions and is not a substitute for an emergency line.
          </div>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <Field label="What do you need?">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                ["emergency","Emergency transport"],
                ["clinic","Clinic appointment"],
                ["screening","Mobile screening"],
                ["rental","Ambulance rental"],
                ["training","Training & certification"],
                ["general","General enquiry"],
              ].map(([k,label]) => (
                <button key={k} type="button" onClick={() => setKind(k as Kind)} className={`px-3 py-2.5 rounded-md border text-sm text-left ${kind===k ? "border-action bg-action/10 text-foreground" : "border-hairline bg-panel text-muted-foreground hover:text-foreground"}`}>{label}</button>
              ))}
            </div>
          </Field>

          {kind === "emergency" && (
            <Field label="Severity">
              <div className="grid grid-cols-3 gap-2">
                {(["code_red","code_yellow","routine"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setSeverity(s)} className={`px-3 py-2 rounded-md border mono text-[10px] uppercase tracking-widest ${severity===s ? (s==="code_red"?"border-emergency bg-emergency/15 text-emergency":s==="code_yellow"?"border-warning bg-warning/15 text-warning":"border-stable bg-stable/15 text-stable") : "border-hairline bg-panel text-muted-foreground"}`}>
                    {s.replace("_"," ")}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Your name *"><Text v={form.name} on={(v) => setForm({...form, name: v})} max={120} placeholder="Full name" /></Field>
            <Field label="Phone"><Text v={form.phone} on={(v) => setForm({...form, phone: v})} max={40} placeholder="+1 555 0100" /></Field>
            <Field label="Email"><Text v={form.email} on={(v) => setForm({...form, email: v})} max={255} placeholder="you@example.com" type="email" /></Field>
            <Field label="City / region"><Text v={form.city} on={(v) => setForm({...form, city: v})} max={120} placeholder="City" /></Field>
          </div>

          <Field label="Pickup / location">
            <div className="flex gap-2">
              <Text v={form.address} on={(v) => setForm({...form, address: v})} max={500} placeholder="Street, building, landmark" />
              <button type="button" onClick={locate} className="shrink-0 inline-flex items-center gap-1.5 px-3 rounded-md border border-action/40 text-action mono text-[10px] uppercase tracking-widest"><Crosshair className="size-3.5" /> Use my location</button>
            </div>
            {coords && <div className="mono text-[10px] text-muted-foreground mt-1.5">GPS · {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</div>}
          </Field>

          {kind !== "emergency" && kind !== "general" && (
            <Field label="Specific service (optional)"><Text v={form.service} on={(v) => setForm({...form, service: v})} max={200} placeholder={kind === "clinic" ? "e.g. cardiology, dermatology" : kind === "screening" ? "e.g. pre-employment package" : kind === "rental" ? "e.g. ALS unit, 3 days" : "e.g. ALS recertification"} /></Field>
          )}

          <Field label={kind === "emergency" ? "Symptoms / description *" : "Message"}>
            <textarea value={form.message} onChange={(e) => setForm({...form, message: e.target.value})} maxLength={2000} rows={4} placeholder={kind === "emergency" ? "Describe what's happening." : "How can we help?"} className="w-full p-3 rounded-md bg-panel border border-hairline text-sm" />
          </Field>

          <button disabled={submitting} type="submit" className="w-full h-12 rounded-md bg-emergency text-emergency-foreground mono text-[11px] uppercase tracking-widest font-bold disabled:opacity-60 inline-flex items-center justify-center gap-2">
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {kind === "emergency" ? "Submit dispatch request" : "Submit request"}
          </button>
          <p className="text-[11px] text-muted-foreground text-center">By submitting you agree we may contact you about this request.</p>
        </form>
      </section>
      <SiteFooter />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
function Text({ v, on, max, placeholder, type = "text" }: { v: string; on: (v: string) => void; max: number; placeholder?: string; type?: string }) {
  return <input type={type} value={v} onChange={(e) => on(e.target.value)} maxLength={max} placeholder={placeholder} className="w-full h-10 px-3 rounded-md bg-panel border border-hairline text-sm" />;
}