import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FlaskRound, RotateCcw, Users, Database, Copy, CheckCircle2, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

const ACCOUNTS = [
  ["superadmin@demo.velomedos.com", "Superadmin",       "/superadmin"],
  ["admin@demo.velomedos.com",      "Tenant Admin",     "/clinical"],
  ["doctor@demo.velomedos.com",     "Physician",        "/clinical"],
  ["nurse@demo.velomedos.com",      "Nurse",            "/clinical"],
  ["coder@demo.velomedos.com",      "Coder",            "/clinical"],
  ["rcm@demo.velomedos.com",        "RCM",              "/clinical"],
  ["approver@demo.velomedos.com",   "Approval officer", "/clinical"],
  ["cashier@demo.velomedos.com",    "Cashier",          "/clinical"],
  ["biller@demo.velomedos.com",     "Biller",           "/clinical"],
  ["claims@demo.velomedos.com",     "Claims officer",   "/clinical"],
  ["finance@demo.velomedos.com",    "Finance",          "/clinical"],
  ["readonly@demo.velomedos.com",   "Read-only",        "/clinical"],
  ["patient@demo.velomedos.com",    "Patient (linked)", "/patient"],
] as const;

type RunOutcome = "idle" | "running" | "success" | "error";
type RunState = { status: RunOutcome; result: unknown; message: string | null; startedAt: number | null; finishedAt: number | null };

const INITIAL: RunState = { status: "idle", result: null, message: null, startedAt: null, finishedAt: null };

export function DemoControlPane() {
  const [users, setUsers] = useState<RunState>(INITIAL);
  const [seed, setSeed]   = useState<RunState>(INITIAL);
  const [reset, setReset] = useState<RunState>(INITIAL);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  async function run(
    set: (s: RunState) => void,
    label: string,
    path: string,
    body: object,
  ) {
    const startedAt = Date.now();
    set({ status: "running", result: null, message: `${label}…`, startedAt, finishedAt: null });
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      const ok = r.ok && json && (json.ok !== false);
      const message = ok
        ? (typeof json.message === "string" ? json.message : `${label} completed (HTTP ${r.status}).`)
        : (typeof json.error === "string" ? json.error : `HTTP ${r.status} — ${r.statusText || "failed"}`);
      set({ status: ok ? "success" : "error", result: json, message, startedAt, finishedAt: Date.now() });
      if (ok) toast.success(`${label} succeeded`);
      else toast.error(`${label} failed: ${message}`);
    } catch (e) {
      const message = (e as Error).message ?? "Network error";
      set({ status: "error", result: null, message, startedAt, finishedAt: Date.now() });
      toast.error(`${label} failed: ${message}`);
    }
  }

  const provision = () => run(setUsers, "Provision users", "/api/admin/v1/demo/seed", { step: "users" });
  const seedData  = () => run(setSeed,  "Seed beneficiaries", "/api/admin/v1/demo/seed", { step: "data" });
  async function doReset() {
    if (!confirm("Reset all transactional data for the DEMO tenant and re-seed?")) return;
    await run(setReset, "Reset tenant", "/api/admin/v1/demo/reset", { reseed: true });
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="size-10 grid place-items-center rounded-lg bg-caution/15 text-caution">
          <FlaskRound className="size-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Demo Environment</h2>
          <p className="text-[12px] text-muted-foreground">
            Sandbox tenant <span className="mono">demo-hospital</span> · NPHIES / ZATCA / D365 / Grouper are stubbed.
            Real tenants are never touched.
          </p>
        </div>
      </header>

      <div className="flex items-center justify-between text-[11px]">
        <div className="text-muted-foreground">
          Quick links:&nbsp;
          <Link to="/demo-login" className="text-action underline mono">/demo-login</Link>
          <span className="mx-1">·</span>
          <a href="/clinical" className="text-action underline mono">/clinical</a>
          <span className="mx-1">·</span>
          <a href="/patient" className="text-action underline mono">/patient</a>
        </div>
        <a href="/demo-login" target="_blank" rel="noreferrer" className="mono text-[10px] uppercase tracking-widest text-action inline-flex items-center gap-1">
          Open demo login <ExternalLink className="size-3" />
        </a>
      </div>

      <section className="grid md:grid-cols-3 gap-3">
        <ControlCard
          icon={<Users className="size-4" />}
          title="Provision users"
          desc="Create or refresh the 13 demo accounts and reset passwords to the shared DEMO_USER_PASSWORD."
          actionLabel="Provision"
          state={users}
          onClick={provision}
        />
        <ControlCard
          icon={<Database className="size-4" />}
          title="Seed data"
          desc="Insert demo beneficiaries (idempotent). Masters/journey fixtures install via the SQL pack."
          actionLabel="Seed"
          state={seed}
          onClick={seedData}
        />
        <ControlCard
          icon={<RotateCcw className="size-4" />}
          title="Reset tenant"
          desc="Scoped DELETE on transactional tables for the demo tenant only, then re-seed. Never TRUNCATE."
          actionLabel="Reset"
          danger
          state={reset}
          onClick={doReset}
        />
      </section>

      <section className="rounded-lg border border-hairline bg-panel/40">
        <div className="px-4 py-3 border-b border-hairline flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Demo access sheet</div>
            <div className="text-[11px] text-muted-foreground">Shared password from secret <span className="mono">DEMO_USER_PASSWORD</span>.</div>
          </div>
          <Button size="sm" variant="ghost"
            onClick={() => navigator.clipboard.writeText(ACCOUNTS.map((a) => a.join(" · ")).join("\n"))}>
            <Copy className="size-3.5 mr-1.5" />Copy roster
          </Button>
        </div>
        <table className="w-full text-[12px]">
          <thead className="text-[10.5px] mono uppercase tracking-[0.18em] text-muted-foreground">
            <tr><th className="text-left px-4 py-2">Email</th><th className="text-left">Role</th><th className="text-left">Lands on</th></tr>
          </thead>
          <tbody>
            {ACCOUNTS.map(([email, role, lands]) => (
              <tr key={email} className="border-t border-hairline/60">
                <td className="px-4 py-1.5 mono">{email}</td>
                <td>{role}</td>
                <td className="mono text-muted-foreground">{lands}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function ControlCard({ icon, title, desc, actionLabel, onClick, state, danger }: {
  icon: React.ReactNode; title: string; desc: string; actionLabel: string;
  onClick: () => void; state: RunState; danger?: boolean;
}) {
  const busy = state.status === "running";
  const elapsed = state.startedAt && state.finishedAt ? `${((state.finishedAt - state.startedAt) / 1000).toFixed(1)}s` : null;
  return (
    <div className="rounded-lg border border-hairline bg-panel/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className={`size-7 grid place-items-center rounded ${danger ? "bg-caution/15 text-caution" : "bg-teal/15 text-teal"}`}>{icon}</span>
        <div className="font-semibold text-sm">{title}</div>
        {state.status !== "idle" && (
          <span className={`ml-auto mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded ${
            state.status === "success" ? "bg-stable/15 text-stable" :
            state.status === "error" ? "bg-emergency/15 text-emergency" :
            "bg-action/15 text-action"
          }`}>
            {state.status}
          </span>
        )}
      </div>
      <p className="text-[11.5px] text-muted-foreground leading-relaxed">{desc}</p>
      <Button size="sm" variant={danger ? "destructive" : "default"} disabled={busy} onClick={onClick}>
        {busy ? (<><Loader2 className="size-3.5 animate-spin mr-1.5" />Working…</>) : actionLabel}
      </Button>
      {busy && (
        <div className="h-1 w-full rounded bg-background/60 overflow-hidden">
          <div className="h-full w-1/3 bg-action animate-[pulse_1.4s_ease-in-out_infinite]" />
        </div>
      )}
      {state.message && (
        <div className={`flex items-start gap-2 text-[11px] rounded border px-2 py-1.5 ${
          state.status === "success" ? "border-stable/40 bg-stable/5 text-stable" :
          state.status === "error" ? "border-emergency/40 bg-emergency/5 text-emergency" :
          "border-hairline bg-background/60 text-muted-foreground"
        }`}>
          {state.status === "success" ? <CheckCircle2 className="size-3.5 mt-0.5 shrink-0" /> :
           state.status === "error" ? <AlertTriangle className="size-3.5 mt-0.5 shrink-0" /> :
           <Loader2 className="size-3.5 mt-0.5 shrink-0 animate-spin" />}
          <span className="leading-snug break-words">{state.message}{elapsed ? ` · ${elapsed}` : ""}</span>
        </div>
      )}
      {state.result ? (
        <details className="text-[10.5px]">
          <summary className="mono uppercase tracking-widest text-muted-foreground cursor-pointer">Raw response</summary>
          <pre className="mt-1 mono bg-background/60 border border-hairline rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap">
            {JSON.stringify(state.result, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}