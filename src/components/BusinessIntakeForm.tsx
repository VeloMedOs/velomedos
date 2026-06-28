import { useState } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Building2 } from "lucide-react";
import { z } from "zod";
import { adminFetch } from "@/lib/admin-fetch";

const schema = z.object({
  company_name: z.string().trim().min(2, "Required").max(200),
  legal_name: z.string().trim().max(200).optional().or(z.literal("")),
  nick_name: z.string().trim().max(120).optional().or(z.literal("")),
  vat_number: z.string().trim().max(60).optional().or(z.literal("")),
  cr_number: z.string().trim().max(60).optional().or(z.literal("")),
  website_url: z.string().trim().url("Invalid URL").max(500).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  contact_name: z.string().trim().min(2, "Required").max(120),
  contact_email: z.string().trim().email("Invalid email").max(255),
  contact_phone: z.string().trim().max(40).optional().or(z.literal("")),
  fleet_size: z.string().trim().optional().or(z.literal("")),
  expected_seats: z.string().trim().optional().or(z.literal("")),
  use_case: z.string().trim().max(2000).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  source_detail: z.string().trim().max(200).optional().or(z.literal("")),
});

type Mode = "public" | "admin";

export function BusinessIntakeForm({
  mode = "public",
  defaultSource = "website",
  onCreated,
  compact,
}: {
  mode?: Mode;
  /** when mode==="admin" — used as source on the created request */
  defaultSource?: "website" | "call_center" | "partner" | "referral" | "event" | "other";
  onCreated?: (id: string) => void;
  compact?: boolean;
}) {
  const [form, setForm] = useState({
    company_name: "", legal_name: "", nick_name: "", vat_number: "", cr_number: "",
    website_url: "", country: "", city: "", contact_name: "", contact_email: "",
    contact_phone: "", fleet_size: "", expected_seats: "", use_case: "", notes: "",
    source_detail: "",
  });
  const [source, setSource] = useState<typeof defaultSource>(defaultSource);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ id: string; company_name: string } | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return toast.error(`${first.path.join(".")}: ${first.message}`);
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { ...parsed.data };
      // Clean empty strings → null & numerics
      for (const k of Object.keys(payload)) if (payload[k] === "") payload[k] = null;
      payload.fleet_size      = form.fleet_size      ? Number(form.fleet_size)      : null;
      payload.expected_seats  = form.expected_seats  ? Number(form.expected_seats)  : null;

      if (mode === "public") {
        const r = await fetch("/api/public/v1/business_intake", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
        setDone({ id: j.request.id, company_name: j.request.company_name });
        onCreated?.(j.request.id);
      } else {
        payload.source = source;
        payload.stage = "request";
        const j = await adminFetch<{ id: string; company_name: string }>("/api/admin/v1/business-requests", {
          method: "POST", body: payload,
        });
        setDone({ id: j.id, company_name: j.company_name });
        onCreated?.(j.id);
      }
      toast.success("Business request created");
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-stable/40 bg-stable/10 p-6 space-y-3 text-sm">
        <div className="flex items-center gap-2 text-stable"><CheckCircle2 className="size-5" /> <span className="font-semibold">Request received</span></div>
        <div>Thanks — we logged <span className="font-semibold">{done.company_name}</span> in our pipeline. Reference:</div>
        <code className="mono text-[11px] break-all block bg-panel-elevated p-2 rounded">{done.id}</code>
        <button onClick={() => { setDone(null); setForm({ ...form, company_name: "", legal_name: "", nick_name: "", vat_number: "", cr_number: "", contact_name: "", contact_email: "", contact_phone: "" }); }}
          className="mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-hairline hover:bg-panel-elevated">
          Submit another
        </button>
      </div>
    );
  }

  const grid = compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 md:grid-cols-2";
  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "admin" && (
        <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-widest">
          <span className="text-muted-foreground">Source</span>
          <select value={source} onChange={(e) => setSource(e.target.value as typeof source)}
            className="bg-panel-elevated border border-hairline rounded px-2 py-1">
            <option value="call_center">Call center</option>
            <option value="website">Website</option>
            <option value="partner">Partner</option>
            <option value="referral">Referral</option>
            <option value="event">Event</option>
            <option value="other">Other</option>
          </select>
        </div>
      )}

      <Section title="Business identity" icon={<Building2 className="size-3.5 text-action" />}>
        <div className={`grid ${grid} gap-3`}>
          <Field label="Legal business name *" v={form.legal_name} on={(v) => { set("legal_name", v); if (!form.company_name) set("company_name", v); }} />
          <Field label="Company / trading name *" v={form.company_name} on={(v) => set("company_name", v)} required />
          <Field label="Nickname / short name"  v={form.nick_name} on={(v) => set("nick_name", v)} />
          <Field label="Website URL"            v={form.website_url} on={(v) => set("website_url", v)} placeholder="https://" />
          <Field label="VAT number"             v={form.vat_number} on={(v) => set("vat_number", v)} mono />
          <Field label="CR number"              v={form.cr_number} on={(v) => set("cr_number", v)} mono />
          <Field label="Country"                v={form.country} on={(v) => set("country", v)} />
          <Field label="City"                   v={form.city} on={(v) => set("city", v)} />
        </div>
      </Section>

      <Section title="Primary contact">
        <div className={`grid ${grid} gap-3`}>
          <Field label="Contact name *"  v={form.contact_name} on={(v) => set("contact_name", v)} required />
          <Field label="Contact email *" v={form.contact_email} on={(v) => set("contact_email", v)} type="email" required />
          <Field label="Contact phone"   v={form.contact_phone} on={(v) => set("contact_phone", v)} type="tel" />
          {mode === "admin" && <Field label="Source detail (campaign / agent)" v={form.source_detail} on={(v) => set("source_detail", v)} />}
        </div>
      </Section>

      <Section title="Business size & use case">
        <div className={`grid ${grid} gap-3`}>
          <Field label="Fleet size"     v={form.fleet_size} on={(v) => set("fleet_size", v)} type="number" />
          <Field label="Expected seats" v={form.expected_seats} on={(v) => set("expected_seats", v)} type="number" />
        </div>
        <Field label="Use case" v={form.use_case} on={(v) => set("use_case", v)} textarea />
        <Field label="Notes"    v={form.notes}    on={(v) => set("notes", v)}    textarea />
      </Section>

      <button type="submit" disabled={submitting}
        className="h-11 px-6 rounded-md bg-teal text-background mono text-xs uppercase tracking-widest font-bold inline-flex items-center gap-2 disabled:opacity-60">
        {submitting && <Loader2 className="size-4 animate-spin" />}
        {mode === "public" ? "Submit request" : "Create business request"}
      </button>
    </form>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-hairline bg-panel/40 p-4 space-y-3">
      <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-1.5">{icon}{title}</div>
      {children}
    </div>
  );
}

function Field({ label, v, on, type = "text", required, mono, textarea, placeholder }: {
  label: string; v: string; on: (v: string) => void;
  type?: string; required?: boolean; mono?: boolean; textarea?: boolean; placeholder?: string;
}) {
  const cls = `w-full h-10 px-3 rounded bg-input border border-hairline text-sm ${mono ? "mono" : ""}`;
  return (
    <label className="block space-y-1">
      <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {textarea
        ? <textarea value={v} onChange={(e) => on(e.target.value)} placeholder={placeholder} rows={3}
            className="w-full px-3 py-2 rounded bg-input border border-hairline text-sm" />
        : <input type={type} required={required} value={v} placeholder={placeholder}
            onChange={(e) => on(e.target.value)} className={cls} />}
    </label>
  );
}