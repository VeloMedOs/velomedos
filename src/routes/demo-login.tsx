import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Copy, LogIn, Stethoscope, ShieldAlert, ExternalLink,
  CheckCircle2, AlertTriangle, KeyRound, User2, FlaskRound,
} from "lucide-react";
import { BrandMark, BrandWordmark } from "@/components/BrandMark";
import { clinicalDestinationFor } from "@/lib/clinical-role-landing";

/**
 * /demo-login — public, dedicated entry point for the VeloMed sandbox.
 * Lists every demo account, exposes copy-to-clipboard for email + shared
 * password, and offers a single-click sign-in that routes the user to the
 * correct HIS section on /clinical (or /superadmin / /patient).
 */

type Acct = {
  email: string;
  role: string;
  clinical_role: string | null;
  blurb: string;
  lands_on: string;
};

const ACCOUNTS: Acct[] = [
  { email: "superadmin@demo.velomedos.com", role: "Platform Superadmin", clinical_role: null,              blurb: "Tenants, billing, access control",                    lands_on: "/superadmin" },
  { email: "admin@demo.velomedos.com",      role: "Tenant Admin",        clinical_role: "tenant_admin",     blurb: "Full HIS · all encounters & claims",                  lands_on: "/clinical?tab=encounters" },
  { email: "doctor@demo.velomedos.com",     role: "Physician",           clinical_role: "physician",        blurb: "Encounters, diagnoses, orders",                       lands_on: "/clinical?tab=encounters" },
  { email: "nurse@demo.velomedos.com",      role: "Nurse",               clinical_role: "nurse",            blurb: "Vitals, MAR, triage",                                 lands_on: "/clinical?tab=encounters" },
  { email: "coder@demo.velomedos.com",      role: "Clinical Coder",      clinical_role: "coder",            blurb: "ICD-10-AM coding, DRG grouping",                      lands_on: "/clinical?tab=coding" },
  { email: "rcm@demo.velomedos.com",        role: "RCM Specialist",      clinical_role: "rcm",              blurb: "Eligibility, pre-auth, claim hygiene",                lands_on: "/clinical?tab=claims" },
  { email: "approver@demo.velomedos.com",   role: "Approval Officer",    clinical_role: "approval_officer", blurb: "Pre-auth approvals queue",                            lands_on: "/clinical?tab=claims" },
  { email: "cashier@demo.velomedos.com",    role: "Cashier",             clinical_role: "cashier",          blurb: "Patient share collection, receipts",                  lands_on: "/clinical?tab=claims" },
  { email: "biller@demo.velomedos.com",     role: "Biller",              clinical_role: "biller",           blurb: "Claim assembly & submission",                         lands_on: "/clinical?tab=claims" },
  { email: "claims@demo.velomedos.com",     role: "Claims Officer",      clinical_role: "claims_officer",   blurb: "NPHIES responses, denials, rework",                   lands_on: "/clinical?tab=claims" },
  { email: "finance@demo.velomedos.com",    role: "Finance",             clinical_role: "finance",          blurb: "Reconciliation, ZATCA, D365 postings",                lands_on: "/clinical?tab=claims" },
  { email: "readonly@demo.velomedos.com",   role: "Read-Only Auditor",   clinical_role: "read_only",        blurb: "View-only access across HIS",                         lands_on: "/clinical?tab=encounters" },
  { email: "patient@demo.velomedos.com",    role: "Patient",             clinical_role: null,               blurb: "Personal record, PROMs, ambulance",                   lands_on: "/patient" },
];

export const Route = createFileRoute("/demo-login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Demo sign-in · VeloMed OS sandbox" },
      { name: "description", content: "Public demo accounts for the VeloMed OS sandbox — one-click sign-in into HIS, RCM, dispatch and patient apps." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DemoLogin,
});

function DemoLogin() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    // Best-effort: pre-fill from a public hint (?p=) when an operator shares
    // the link. The real shared password lives only in the project secret.
    const url = new URL(window.location.href);
    const hint = url.searchParams.get("p");
    if (hint) setPw(hint);
  }, []);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Clipboard blocked — copy manually");
    }
  }

  async function signIn(a: Acct) {
    if (!pw) {
      toast.error("Paste the shared demo password first");
      return;
    }
    setBusy(a.email);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: a.email, password: pw });
      if (error) throw error;
      let dest = a.lands_on;
      if (dest === "/clinical" || dest.startsWith("/clinical?")) {
        // Recompute from clinical_role in case the seed adds more roles later.
        dest = a.clinical_role ? clinicalDestinationFor(a.clinical_role) : "/clinical";
      }
      toast.success(`Signed in as ${a.role}`);
      navigate({ to: dest, replace: true });
    } catch (e) {
      toast.error(`Sign-in failed: ${(e as Error).message}`);
      setBusy(null);
    }
  }

  const grouped: { title: string; rows: Acct[] }[] = [
    { title: "Platform", rows: ACCOUNTS.filter((a) => a.role.includes("Superadmin")) },
    { title: "Clinical (HIS)", rows: ACCOUNTS.filter((a) => ["tenant_admin","physician","nurse"].includes(a.clinical_role ?? "")) },
    { title: "Coding & RCM", rows: ACCOUNTS.filter((a) => ["coder","rcm","approval_officer","claims_officer"].includes(a.clinical_role ?? "")) },
    { title: "Cash & Finance", rows: ACCOUNTS.filter((a) => ["cashier","biller","finance"].includes(a.clinical_role ?? "")) },
    { title: "Audit & Patient", rows: ACCOUNTS.filter((a) => a.clinical_role === "read_only" || a.role === "Patient") },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-hairline">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5"><BrandMark className="size-7" /><BrandWordmark /></Link>
          <Link to="/auth" className="mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
            Real sign-in <ExternalLink className="size-3" />
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <section className="rounded-xl border border-caution/40 bg-caution/5 p-5 flex items-start gap-3">
          <ShieldAlert className="size-5 text-caution shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-caution">Sandbox tenant · demo-hospital</div>
            <h1 className="text-xl font-semibold tracking-tight">VeloMed OS demo accounts</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              These 13 accounts share one password set by the platform operator. NPHIES, ZATCA, D365 and the AR-DRG grouper run in stub mode for this tenant — no real PHI, no live payer calls. Each account lands directly on the HIS section relevant to its role.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-hairline bg-panel p-5 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-action" />
            <div className="font-semibold text-sm">Shared password</div>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Paste the password from your operator (project secret <span className="mono">DEMO_USER_PASSWORD</span>), then use the
            <span className="mono"> Sign in</span> button on any account below.
          </p>
          <div className="flex gap-2">
            <input
              type={showPw ? "text" : "password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Paste the shared demo password…"
              className="flex-1 h-10 px-3 rounded-md bg-input border border-hairline mono text-sm"
              autoComplete="off"
            />
            <button onClick={() => setShowPw((s) => !s)} className="px-3 h-10 rounded-md border border-hairline mono text-[10px] uppercase tracking-widest">
              {showPw ? "Hide" : "Show"}
            </button>
            <button onClick={() => pw && copy(pw, "Password")} className="px-3 h-10 rounded-md border border-hairline mono text-[10px] uppercase tracking-widest inline-flex items-center gap-1.5">
              <Copy className="size-3.5" /> Copy
            </button>
          </div>
        </section>

        {grouped.filter((g) => g.rows.length).map((g) => (
          <section key={g.title} className="space-y-3">
            <div className="flex items-center gap-2">
              <Stethoscope className="size-4 text-teal" />
              <h2 className="text-sm font-semibold tracking-tight">{g.title}</h2>
              <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{g.rows.length}</span>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {g.rows.map((a) => (
                <div key={a.email} className="rounded-xl border border-hairline bg-panel/50 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold flex items-center gap-2"><User2 className="size-3.5 text-action" />{a.role}</div>
                      <div className="text-[11.5px] text-muted-foreground mt-0.5">{a.blurb}</div>
                    </div>
                    <span className="mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-teal/10 text-teal whitespace-nowrap">{a.lands_on}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate mono text-[11.5px] px-2 py-1.5 rounded bg-background/60 border border-hairline">{a.email}</code>
                    <button onClick={() => copy(a.email, "Email")} className="px-2 h-7 rounded border border-hairline mono text-[10px] uppercase tracking-widest inline-flex items-center gap-1">
                      <Copy className="size-3" /> Email
                    </button>
                    <button onClick={() => signIn(a)} disabled={busy === a.email || !pw} className="px-2.5 h-7 rounded bg-action text-action-foreground mono text-[10px] uppercase tracking-widest inline-flex items-center gap-1 disabled:opacity-50">
                      {busy === a.email ? "…" : <><LogIn className="size-3" /> Sign in</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="rounded-xl border border-hairline bg-panel/40 p-5 text-[12px] text-muted-foreground space-y-2">
          <div className="flex items-center gap-2 text-foreground"><FlaskRound className="size-4 text-caution" /><span className="font-semibold text-sm">Operator notes</span></div>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provision / refresh accounts from <Link to="/superadmin" className="text-action underline">/superadmin</Link> → <span className="mono">Demo Environment</span>.</li>
            <li>The shared password rotates whenever <span className="mono">DEMO_USER_PASSWORD</span> is updated and accounts are re-provisioned.</li>
            <li>Reset endpoint refuses to run unless the tenant has <span className="mono">is_demo = true</span> — real tenants are never touched.</li>
          </ul>
          <div className="flex flex-wrap gap-2 pt-2">
            <a className="mono text-[10px] uppercase tracking-widest text-action inline-flex items-center gap-1" href="/superadmin">Open Superadmin <ExternalLink className="size-3" /></a>
            <a className="mono text-[10px] uppercase tracking-widest text-action inline-flex items-center gap-1" href="/clinical">Open Clinical <ExternalLink className="size-3" /></a>
            <a className="mono text-[10px] uppercase tracking-widest text-action inline-flex items-center gap-1" href="/patient">Open Patient <ExternalLink className="size-3" /></a>
          </div>
        </section>
      </main>
    </div>
  );
}

// Keeping these imports referenced so tree-shaking doesn't drop the icons
// from the production bundle in dev builds.
void CheckCircle2; void AlertTriangle;