import { useState } from "react";
import { ShieldCheck, FileCheck2, Receipt, Activity, AlertOctagon, CheckCircle2, Clock } from "lucide-react";

type Sub = "eligibility" | "authorization" | "claim";

export function CareRevenuePanel() {
  const [sub, setSub] = useState<Sub>("claim");
  return (
    <div className="relative h-full min-h-[520px] rounded-2xl border border-hairline bg-panel/70 backdrop-blur-md p-4 lg:p-5 flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-hairline bg-background/40 mono text-[10px] uppercase tracking-widest">
          {(["eligibility","authorization","claim"] as Sub[]).map((s) => (
            <button key={s} onClick={() => setSub(s)}
              className={`px-2.5 py-1.5 transition-colors ${sub === s ? "bg-teal/15 text-teal" : "text-muted-foreground hover:text-foreground"}`}>
              {s}
            </button>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-widest text-coral">
          <span className="size-1.5 rounded-full bg-coral animate-pulse" /> live
        </span>
      </div>

      {sub === "eligibility" && <EligibilityPane />}
      {sub === "authorization" && <AuthorizationPane />}
      {sub === "claim" && <ClaimPane />}

      <RevenueMeters />
    </div>
  );
}

function Row({ label, value, tone = "txt" }: { label: string; value: React.ReactNode; tone?: "txt" | "teal" | "amber" | "coral" | "sky" }) {
  const cls = tone === "teal" ? "text-teal" : tone === "amber" ? "text-amber-300" : tone === "coral" ? "text-coral" : tone === "sky" ? "text-sky" : "text-foreground";
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={`mono text-xs ${cls}`}>{value}</span>
    </div>
  );
}

function EligibilityPane() {
  return (
    <div className="rounded-xl border border-hairline bg-background/40 p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="mono text-[10px] uppercase tracking-widest text-teal">NPHIES eligibility · realtime</div>
          <div className="text-sm font-semibold text-foreground">Sara A. · MRN 0042-9128</div>
        </div>
        <span className="px-2 py-1 rounded mono text-[10px] uppercase bg-teal/15 text-teal">INSURED · LOCKED</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-6">
        <Row label="Payer" value="Bupa Arabia" />
        <Row label="Policy · class" value="GCS-A · Gold" />
        <Row label="In-network" value="YES" tone="teal" />
        <Row label="Copay" value="20%" />
        <Row label="Deductible left" value="SAR 350" />
        <Row label="Financial type" value="INSURED" tone="teal" />
      </div>
    </div>
  );
}

function AuthorizationPane() {
  return (
    <div className="rounded-xl border border-hairline bg-background/40 p-4">
      <div className="mono text-[10px] uppercase tracking-widest text-teal mb-2">Pre-authorization · KSA rules</div>
      <ul className="divide-y divide-hairline">
        {[
          { item: "MRI Brain w/ contrast", status: "APPROVED", tone: "teal" as const, note: "Auth #A-9842 · 14d" },
          { item: "GLP-1 (high-control)", status: "PENDING · TAT 24h", tone: "amber" as const, note: "Awaiting clinical justification" },
          { item: "Cardiology consult", status: "NO AUTH REQ", tone: "sky" as const, note: "Policy bundle covers" },
        ].map((r) => (
          <li key={r.item} className="py-2 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm">{r.item}</div>
              <div className="text-[11px] text-muted-foreground">{r.note}</div>
            </div>
            <span className={`mono text-[10px] uppercase px-2 py-1 rounded ${
              r.tone === "teal" ? "bg-teal/15 text-teal" :
              r.tone === "amber" ? "bg-amber-500/15 text-amber-300" :
              "bg-sky/15 text-sky"}`}>{r.status}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>Approved value</span><span className="text-foreground">SAR 4,820</span>
      </div>
    </div>
  );
}

function ClaimPane() {
  return (
    <div className="rounded-xl border border-hairline bg-background/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="mono text-[10px] uppercase tracking-widest text-teal">Claim #CLM-26-001284</div>
          <div className="text-sm font-semibold text-foreground">IP · AR-DRG bundled · Insurer A</div>
        </div>
        <span className="mono text-[10px] uppercase px-2 py-1 rounded bg-sky/15 text-sky">ADJUDICATING</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Chip ok>Eligible</Chip><Chip ok>Auth</Chip><Chip ok>Coded</Chip>
        <Chip arrow>Submitted</Chip><Chip warn>1 denied</Chip>
      </div>
      <Row label="Gross" value="SAR 9,420.00" />
      <Row label="Contractual adjustment" value="− 1,180.00" tone="coral" />
      <Row label="AR-DRG bundle · C16B × 1.84" value="SAR 8,240.00" tone="teal" />
      <div className="my-3 h-2 rounded-full bg-hairline overflow-hidden flex">
        <span className="bg-teal" style={{ width: "76%" }} />
        <span className="bg-sky" style={{ width: "12%" }} />
        <span className="bg-amber-400" style={{ width: "12%" }} />
      </div>
      <div className="grid grid-cols-3 mono text-[10px] uppercase tracking-widest gap-2">
        <div><div className="text-teal">Payer pays</div><div className="text-foreground">6,262.40</div></div>
        <div><div className="text-sky">Patient share</div><div className="text-foreground">988.80</div></div>
        <div><div className="text-amber-300">VAT 15%</div><div className="text-foreground">988.80</div></div>
      </div>
    </div>
  );
}

function Chip({ children, ok, warn, arrow }: { children: React.ReactNode; ok?: boolean; warn?: boolean; arrow?: boolean }) {
  const cls = ok ? "bg-teal/12 text-teal border-teal/30" : warn ? "bg-coral/12 text-coral border-coral/30" : arrow ? "bg-sky/12 text-sky border-sky/30" : "bg-panel border-hairline";
  return <span className={`mono text-[10px] uppercase px-2 py-0.5 rounded-full border ${cls}`}>{children}</span>;
}

function RevenueMeters() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-hairline rounded-xl overflow-hidden border border-hairline">
      {[
        { label: "First-pass %", value: "94.2", trend: "+3.1 vs 90d", tone: "teal" as const, icon: CheckCircle2 },
        { label: "Denial %", value: "3.6", trend: "−1.2 vs 90d", tone: "teal" as const, icon: AlertOctagon },
        { label: "Days-to-claim", value: "1.4d", trend: "baseline 4.2d", tone: "sky" as const, icon: Clock },
        { label: "Coding · NPHIES", value: "ACCEPTED", trend: "ZATCA CLEARED", tone: "teal" as const, icon: ShieldCheck },
      ].map((m) => (
        <div key={m.label} className="bg-background/40 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="mono text-[9.5px] uppercase tracking-widest text-muted-foreground">{m.label}</div>
            <m.icon className={`size-3.5 ${m.tone === "teal" ? "text-teal" : "text-sky"}`} />
          </div>
          <div className={`mono text-base font-semibold ${m.tone === "teal" ? "text-teal" : "text-sky"}`}>{m.value}</div>
          <div className="mono text-[9.5px] uppercase tracking-widest text-muted-foreground mt-1">{m.trend}</div>
        </div>
      ))}
    </div>
  );
}