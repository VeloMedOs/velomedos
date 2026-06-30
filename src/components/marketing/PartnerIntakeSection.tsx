import { useState } from "react";
import { ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";

type Status = "idle" | "submitting" | "ok" | "err";

const ORG_TYPES = [
  { id: "hospital", label: "Hospital" },
  { id: "clinic_group", label: "Clinic group" },
  { id: "ems", label: "EMS / transport" },
  { id: "payer_tpa", label: "Payer / TPA" },
];

export function PartnerIntakeSection() {
  const [status, setStatus] = useState<Status>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    company_name: "", contact_name: "", contact_email: "", contact_phone: "",
    org_type: "hospital", expected_seats: "", message: "", consent: false, _hp: "",
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (form._hp) { setStatus("ok"); return; } // honeypot
    if (!form.consent) { setStatus("err"); setErrMsg("Please confirm you can be contacted about VeloMed OS."); return; }
    setStatus("submitting"); setErrMsg(null);
    const seats = Number(form.expected_seats);
    const payload = {
      company_name: form.company_name.trim(),
      contact_name: form.contact_name.trim(),
      contact_email: form.contact_email.trim(),
      contact_phone: form.contact_phone.trim() || null,
      expected_seats: Number.isFinite(seats) && seats > 0 ? seats : null,
      use_case: form.message.trim() || null,
      source_detail: `partner_section:${form.org_type}`,
    };
    try {
      const r = await fetch("/api/public/v1/business_intake", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        setStatus("err");
        setErrMsg(body?.error === "rate_limited" ? "Too many requests — try again in a minute." : "Submission failed. Please email hello@velomed.health.");
        return;
      }
      setStatus("ok");
    } catch {
      setStatus("err"); setErrMsg("Network error. Please email hello@velomed.health.");
    }
  }

  return (
    <section id="partner" className="border-t border-hairline">
      <div className="max-w-[1100px] mx-auto px-4 lg:px-8 py-20 grid lg:grid-cols-2 gap-10 items-start">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal mb-2">Become a subscriber</div>
          <h2 className="font-serif text-4xl lg:text-5xl tracking-tight">Bring VeloMed OS to your hospital or network.</h2>
          <p className="text-muted-foreground mt-5 max-w-[48ch] leading-relaxed">
            Sandbox-first onboarding. We bring sample data — patients, payers, codes, an ambulance fleet —
            preloaded with your operating cities. Weeks, not years, to go live.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-foreground/85">
            {[
              "NPHIES + ZATCA integration-ready, sandboxed until credentials are live.",
              "Per-module access with privilege audit — governance is a feature.",
              "One OS for ambulance, clinical and revenue — born unified.",
            ].map((l) => (
              <li key={l} className="flex items-start gap-2">
                <CheckCircle2 className="size-4 text-teal mt-0.5 shrink-0" />
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-hairline bg-panel/60 backdrop-blur p-6">
          {status === "ok" ? (
            <div className="text-center py-10">
              <CheckCircle2 className="size-9 text-teal mx-auto mb-3" />
              <div className="font-semibold text-lg">Request received.</div>
              <p className="text-sm text-muted-foreground mt-2 max-w-[36ch] mx-auto">
                A VeloMed lead will reach out within one business day with a sandbox link tailored to your network.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Field label="Organization name">
                <input value={form.company_name} onChange={(e) => set("company_name", e.target.value)}
                  className="input" placeholder="Acme Hospital Group" autoComplete="organization" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Organization type">
                  <select value={form.org_type} onChange={(e) => set("org_type", e.target.value)} className="input">
                    {ORG_TYPES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Est. seats / beds">
                  <input value={form.expected_seats} onChange={(e) => set("expected_seats", e.target.value)}
                    inputMode="numeric" className="input" placeholder="150" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contact name">
                  <input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} className="input" autoComplete="name" />
                </Field>
                <Field label="Work email">
                  <input value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} className="input" type="email" autoComplete="email" />
                </Field>
              </div>
              <Field label="Phone (optional)">
                <input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} className="input" autoComplete="tel" />
              </Field>
              <Field label="What would you like to solve first?">
                <textarea value={form.message} onChange={(e) => set("message", e.target.value)} rows={3} className="input resize-none" placeholder="Cut denials, unify dispatch + HIS, NPHIES onboarding…" />
              </Field>
              {/* honeypot */}
              <input value={form._hp} onChange={(e) => set("_hp", e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={form.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-0.5" />
                <span>I agree VeloMed OS may contact me about onboarding. We don't share contact data; KSA PDPL applies.</span>
              </label>

              {status === "err" && (
                <div className="rounded-md border border-coral/40 bg-coral/10 text-coral text-xs px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                  <span>{errMsg ?? "Something went wrong."}</span>
                </div>
              )}

              <button
                onClick={submit} disabled={status === "submitting" || !form.company_name || !form.contact_email || !form.contact_name}
                className="w-full mono text-[11px] uppercase tracking-widest px-4 py-3 rounded-md inline-flex items-center justify-center gap-2 font-semibold text-background disabled:opacity-50"
                style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-glow-teal)" }}
              >
                Request access <ArrowRight className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .input { width: 100%; background: rgba(8,11,17,0.6); border: 1px solid var(--color-hairline, #1C2532); color: var(--color-foreground, #EAF0F7); border-radius: 8px; padding: 9px 11px; font-size: 13px; transition: border-color .15s; }
        .input:focus { outline: none; border-color: #28D6B6; box-shadow: 0 0 0 2px rgba(40,214,182,0.15); }
      `}</style>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}