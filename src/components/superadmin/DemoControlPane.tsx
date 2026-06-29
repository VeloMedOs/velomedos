import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FlaskRound, RotateCcw, Users, Database, Copy } from "lucide-react";

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

type RunState = { busy: boolean; result: unknown };

export function DemoControlPane() {
  const [users, setUsers] = useState<RunState>({ busy: false, result: null });
  const [seed, setSeed]   = useState<RunState>({ busy: false, result: null });
  const [reset, setReset] = useState<RunState>({ busy: false, result: null });
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  async function call(path: string, body: object): Promise<unknown> {
    const r = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return r.json();
  }

  async function provision() {
    setUsers({ busy: true, result: null });
    setUsers({ busy: false, result: await call("/api/admin/v1/demo/seed", { step: "users" }) });
  }
  async function seedData() {
    setSeed({ busy: true, result: null });
    setSeed({ busy: false, result: await call("/api/admin/v1/demo/seed", { step: "data" }) });
  }
  async function doReset() {
    if (!confirm("Reset all transactional data for the DEMO tenant and re-seed?")) return;
    setReset({ busy: true, result: null });
    setReset({ busy: false, result: await call("/api/admin/v1/demo/reset", { reseed: true }) });
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

      <section className="grid md:grid-cols-3 gap-3">
        <ControlCard
          icon={<Users className="size-4" />}
          title="Provision users"
          desc="Create or refresh the 13 demo accounts and reset passwords to the shared DEMO_USER_PASSWORD."
          actionLabel="Provision"
          busy={users.busy}
          onClick={provision}
          result={users.result}
        />
        <ControlCard
          icon={<Database className="size-4" />}
          title="Seed data"
          desc="Insert demo beneficiaries (idempotent). Masters/journey fixtures install via the SQL pack."
          actionLabel="Seed"
          busy={seed.busy}
          onClick={seedData}
          result={seed.result}
        />
        <ControlCard
          icon={<RotateCcw className="size-4" />}
          title="Reset tenant"
          desc="Scoped DELETE on transactional tables for the demo tenant only, then re-seed. Never TRUNCATE."
          actionLabel="Reset"
          danger
          busy={reset.busy}
          onClick={doReset}
          result={reset.result}
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

function ControlCard({ icon, title, desc, actionLabel, onClick, busy, result, danger }: {
  icon: React.ReactNode; title: string; desc: string; actionLabel: string;
  onClick: () => void; busy: boolean; result: unknown; danger?: boolean;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-panel/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className={`size-7 grid place-items-center rounded ${danger ? "bg-caution/15 text-caution" : "bg-teal/15 text-teal"}`}>{icon}</span>
        <div className="font-semibold text-sm">{title}</div>
      </div>
      <p className="text-[11.5px] text-muted-foreground leading-relaxed">{desc}</p>
      <Button size="sm" variant={danger ? "destructive" : "default"} disabled={busy} onClick={onClick}>
        {busy ? "Working…" : actionLabel}
      </Button>
      {result ? (
        <pre className="text-[10.5px] mono bg-background/60 border border-hairline rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}