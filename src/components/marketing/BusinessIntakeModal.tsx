import { useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

/** Extra fields captured by the modal but not represented as columns on
 *  `business_requests`. Encoded as structured prefixes into `notes` so the
 *  intake endpoint schema stays stable (no migration required). */
export const STRUCTURED_KEYS = [
  "business_type",
  "current_HIS",
  "target_go_live",
  "whitelabel_interest",
  "interested_modules",
] as const;
type StructuredKey = typeof STRUCTURED_KEYS[number];

export function encodeStructuredNotes(freeform: string, extras: Record<StructuredKey, string>): string {
  const trimmedNotes = freeform.trim();
  const prefixLines = STRUCTURED_KEYS
    .filter((k) => extras[k] && extras[k].trim().length > 0)
    .map((k) => `${k}: ${extras[k].trim()}`);
  if (prefixLines.length === 0) return trimmedNotes;
  const header = prefixLines.join("\n");
  return trimmedNotes ? `${header}\n\n${trimmedNotes}` : header;
}

type Form = {
  company_name: string; legal_name: string; cr_number: string; vat_number: string;
  contact_name: string; contact_email: string; contact_phone: string; role: string;
  business_type: string; current_HIS: string; fleet_size: string; expected_seats: string;
  target_go_live: string; whitelabel_interest: string; interested_modules: string[];
  use_case: string; source_detail: string;
};

const EMPTY: Form = {
  company_name: "", legal_name: "", cr_number: "", vat_number: "",
  contact_name: "", contact_email: "", contact_phone: "", role: "",
  business_type: "", current_HIS: "", fleet_size: "", expected_seats: "",
  target_go_live: "", whitelabel_interest: "", interested_modules: [],
  use_case: "", source_detail: "",
};

const MODULES = ["opd", "ipd", "rcm", "dispatch", "homecare", "clinics"];

export function BusinessIntakeModal({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ reference_code: string } | null>(null);

  function set<K extends keyof Form>(k: K, v: Form[K]) { setF((prev) => ({ ...prev, [k]: v })); }
  function toggleModule(m: string) {
    setF((prev) => ({
      ...prev,
      interested_modules: prev.interested_modules.includes(m)
        ? prev.interested_modules.filter((x) => x !== m)
        : [...prev.interested_modules, m],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.company_name || !f.contact_name || !f.contact_email) {
      toast.error("Company, contact name and email are required"); return;
    }
    setBusy(true);
    try {
      const notes = encodeStructuredNotes(f.use_case, {
        business_type: f.business_type,
        current_HIS: f.current_HIS,
        target_go_live: f.target_go_live,
        whitelabel_interest: f.whitelabel_interest,
        interested_modules: f.interested_modules.join(","),
      });
      const res = await fetch("/api/public/v1/business_intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company_name: f.company_name,
          legal_name: f.legal_name || null,
          cr_number: f.cr_number || null,
          vat_number: f.vat_number || null,
          contact_name: f.contact_name,
          contact_email: f.contact_email,
          contact_phone: f.contact_phone || null,
          fleet_size: f.fleet_size ? Number(f.fleet_size) : null,
          expected_seats: f.expected_seats ? Number(f.expected_seats) : null,
          notes,
          use_case: f.use_case || null,
          source_detail: f.source_detail || (f.role ? `role:${f.role}` : null),
        }),
      });
      const data = await res.json() as { ok?: boolean; request?: { id: string }; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Submission failed");
      setDone({ reference_code: (data.request?.id ?? "").slice(0, 8) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="bg-panel border border-hairline rounded-xl w-full max-w-3xl max-h-[92vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-hairline flex items-center justify-between">
          <div className="font-semibold">Book a demo</div>
          <button onClick={onClose} className="size-7 grid place-items-center rounded hover:bg-panel-elevated"><X className="size-4" /></button>
        </div>
        {done ? (
          <div className="p-10 text-center">
            <CheckCircle2 className="size-12 text-stable mx-auto mb-4" />
            <h2 className="text-xl font-bold">Request received</h2>
            <p className="text-sm text-muted-foreground mt-2">A VeloMed team member will follow up within one business day.</p>
            <div className="mono text-lg font-bold mt-4">Ref {done.reference_code}</div>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-5">
            <Section label="Company">
              <Row><Input placeholder="Company name *" value={f.company_name} onChange={(v) => set("company_name", v)} /></Row>
              <Row><Input placeholder="Legal name" value={f.legal_name} onChange={(v) => set("legal_name", v)} /></Row>
              <Row cols={2}>
                <Input placeholder="CR number" value={f.cr_number} onChange={(v) => set("cr_number", v)} />
                <Input placeholder="VAT number" value={f.vat_number} onChange={(v) => set("vat_number", v)} />
              </Row>
            </Section>
            <Section label="Contact">
              <Row cols={2}>
                <Input placeholder="Contact name *" value={f.contact_name} onChange={(v) => set("contact_name", v)} />
                <Input placeholder="Role" value={f.role} onChange={(v) => set("role", v)} />
              </Row>
              <Row cols={2}>
                <Input placeholder="Work email *" type="email" value={f.contact_email} onChange={(v) => set("contact_email", v)} />
                <Input placeholder="Phone" value={f.contact_phone} onChange={(v) => set("contact_phone", v)} />
              </Row>
            </Section>
            <Section label="Operations">
              <Row cols={2}>
                <Input placeholder="Business type (e.g. hospital, ems)" value={f.business_type} onChange={(v) => set("business_type", v)} />
                <Input placeholder="Current HIS (or 'none')" value={f.current_HIS} onChange={(v) => set("current_HIS", v)} />
              </Row>
              <Row cols={2}>
                <Input placeholder="Fleet size" type="number" value={f.fleet_size} onChange={(v) => set("fleet_size", v)} />
                <Input placeholder="Expected seats" type="number" value={f.expected_seats} onChange={(v) => set("expected_seats", v)} />
              </Row>
            </Section>
            <Section label="Goals">
              <Row cols={2}>
                <Input placeholder="Target go-live (e.g. 2026Q4)" value={f.target_go_live} onChange={(v) => set("target_go_live", v)} />
                <select value={f.whitelabel_interest} onChange={(e) => set("whitelabel_interest", e.target.value)}
                        className="w-full h-10 px-3 rounded bg-background border border-hairline text-sm">
                  <option value="">White-label interest?</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="undecided">Undecided</option>
                </select>
              </Row>
              <div>
                <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Interested modules</div>
                <div className="flex flex-wrap gap-1.5">
                  {MODULES.map((m) => (
                    <button type="button" key={m} onClick={() => toggleModule(m)}
                            className={`mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded border ${
                              f.interested_modules.includes(m)
                                ? "border-teal text-teal bg-teal/10"
                                : "border-hairline hover:bg-panel-elevated"
                            }`}>{m}</button>
                  ))}
                </div>
              </div>
            </Section>
            <Section label="Notes">
              <textarea rows={3} value={f.use_case} onChange={(e) => set("use_case", e.target.value)}
                        placeholder="Tell us about your use case…"
                        className="w-full px-3 py-2 rounded bg-background border border-hairline text-sm" />
              <Input placeholder="How did you hear about us?" value={f.source_detail} onChange={(v) => set("source_detail", v)} />
            </Section>
            <button disabled={busy} className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md bg-teal text-background mono text-xs uppercase tracking-widest font-bold disabled:opacity-50">
              {busy ? "Submitting…" : "Request a demo"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal">{label}</div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}
function Row({ children, cols }: { children: React.ReactNode; cols?: number }) {
  return <div className={cols === 2 ? "grid grid-cols-2 gap-2.5" : ""}>{children}</div>;
}
function Input({ value, onChange, placeholder, type }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} type={type ?? "text"} placeholder={placeholder}
           className="w-full h-10 px-3 rounded bg-background border border-hairline text-sm" />
  );
}