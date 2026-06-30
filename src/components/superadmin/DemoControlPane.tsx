import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FlaskRound, RotateCcw, Users, Database, Copy, CheckCircle2, AlertTriangle, Loader2, ExternalLink, KeyRound, RefreshCw, Eye, EyeOff, ShieldCheck, Globe, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import {
  listDemoCredentials,
  rotateDemoCredential,
  rotateAllDemoCredentials,
  applyCredentialsToAuth,
  setDemoPublicReveal,
  type DemoCredentialRow,
} from "@/lib/demo-credentials.functions";
import { useServerFn } from "@tanstack/react-start";

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
const AUTOFILL_KEY = "velomed:demo_autofill";

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
          <Link to="/demo-credentials" className="text-action underline mono">/demo-credentials</Link>
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
          desc="Create or refresh the 13 demo accounts and reset passwords from the per-role credential table."
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

      <CredentialsManager />
    </div>
  );
}

/* ============================================================== */
/* CREDENTIALS MANAGER                                              */
/* ============================================================== */

function CredentialsManager() {
  const list        = useServerFn(listDemoCredentials);
  const rotateOne   = useServerFn(rotateDemoCredential);
  const rotateAll   = useServerFn(rotateAllDemoCredentials);
  const applyAuth   = useServerFn(applyCredentialsToAuth);
  const setRevealFn = useServerFn(setDemoPublicReveal);

  const [rows, setRows] = useState<DemoCredentialRow[] | null>(null);
  const [reveal, setReveal] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [applyState, setApplyState] = useState<RunState>(INITIAL);

  async function load() {
    try {
      const r = await list();
      if (!r.ok) { toast.error(`Load failed: ${r.error}`); return; }
      setRows(r.accounts);
      setReveal(r.public_reveal);
    } catch (e) { toast.error(`Load failed: ${(e as Error).message}`); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function doRotateOne(email: string) {
    setBusy(email);
    try {
      const r = await rotateOne({ data: { email } });
      if (!r.ok) throw new Error(r.error);
      toast.success(`New password for ${email}`);
      await load();
    } catch (e) { toast.error(`Rotate failed: ${(e as Error).message}`); }
    finally { setBusy(null); }
  }

  async function doRotateAll() {
    if (!confirm("Generate fresh passwords for ALL 13 demo accounts?")) return;
    setBusy("__all__");
    try {
      const r = await rotateAll();
      if (!r.ok) throw new Error(r.error);
      toast.success(`Rotated ${r.rotated} accounts`);
      await load();
    } catch (e) { toast.error(`Rotate all failed: ${(e as Error).message}`); }
    finally { setBusy(null); }
  }

  async function doApplyAuth() {
    const startedAt = Date.now();
      setApplyState({ status: "running", result: null, message: "Applying passwords to login users…", startedAt, finishedAt: null });
    try {
      const r = await applyAuth();
      const ok = (r as { ok: boolean }).ok !== false;
        const results = (r as { results?: Array<{ status: string }> }).results ?? [];
        const missing = results.filter((x) => x.status === "missing").length;
        const failed = results.filter((x) => x.status === "error").length;
      setApplyState({
          status: ok && failed === 0 ? "success" : "error",
        result: r,
          message: ok
            ? `Applied ${(r as { synced?: number }).synced ?? 0}/${(r as { total?: number }).total ?? 0} accounts${missing ? ` · ${missing} missing users — click Provision users first` : ""}${failed ? ` · ${failed} failed` : ""}.`
            : (r as { error?: string }).error ?? "Apply failed",
        startedAt, finishedAt: Date.now(),
      });
        if (ok && failed === 0) toast.success("Passwords applied to login users");
      else toast.error("Apply failed");
    } catch (e) {
      setApplyState({ status: "error", result: null, message: (e as Error).message, startedAt, finishedAt: Date.now() });
      toast.error(`Apply failed: ${(e as Error).message}`);
    }
  }

  async function toggleReveal() {
    try {
      const r = await setRevealFn({ data: { enabled: !reveal } });
      if (!r.ok) throw new Error(r.error);
      setReveal(r.enabled);
      toast.success(`Public reveal ${r.enabled ? "ON" : "OFF"}`);
    } catch (e) { toast.error(`Toggle failed: ${(e as Error).message}`); }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`)).catch(() => toast.error("Clipboard blocked"));
  }

  async function launchWithAutofill(row: DemoCredentialRow) {
    const key = row.clinical_role || row.email.split("@")[0];
    const tab = window.open("about:blank", "_blank");
    try {
      window.localStorage.setItem(AUTOFILL_KEY, JSON.stringify({
        email: row.email,
        role: key,
        password: row.password,
        expiresAt: Date.now() + 5 * 60_000,
      }));
    } catch { /* noop */ }
    const startedAt = Date.now();
    setApplyState({ status: "running", result: null, message: `Preparing ${row.role_label} login…`, startedAt, finishedAt: null });
    try {
      const r = await applyAuth();
      const ok = (r as { ok: boolean }).ok !== false;
      if (!ok) throw new Error((r as { error?: string }).error ?? "Apply failed");
      setApplyState({ status: "success", result: r, message: `Login prepared for ${row.role_label}.`, startedAt, finishedAt: Date.now() });
      const href = `/demo-login?role=${encodeURIComponent(key)}&autosignin=1`;
      if (tab) tab.location.href = href;
      else window.open(href, "_blank", "noopener,noreferrer");
    } catch (e) {
      if (tab) tab.close();
      setApplyState({ status: "error", result: null, message: (e as Error).message, startedAt, finishedAt: Date.now() });
      toast.error(`Could not prepare login: ${(e as Error).message}`);
    }
  }

  return (
    <section className="rounded-lg border border-hairline bg-panel/40">
      <div className="px-4 py-3 border-b border-hairline flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2"><KeyRound className="size-4 text-action" />Per-role credentials</div>
          <div className="text-[11px] text-muted-foreground">Flow: generate or type password → apply to login users → enable Public reveal if you want public auto-fill → open sandbox.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShow((s) => !s)}>
            {show ? <EyeOff className="size-3.5 mr-1.5" /> : <Eye className="size-3.5 mr-1.5" />}{show ? "Hide" : "Reveal"}
          </Button>
          <Button size="sm" variant="outline" onClick={doRotateAll} disabled={busy === "__all__"}>
            <RefreshCw className={`size-3.5 mr-1.5 ${busy === "__all__" ? "animate-spin" : ""}`} />Generate all
          </Button>
          <Button size="sm" onClick={doApplyAuth} disabled={applyState.status === "running"}>
            {applyState.status === "running" ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="size-3.5 mr-1.5" />}Apply to login users
          </Button>
          <Button size="sm" variant={reveal ? "default" : "outline"} onClick={toggleReveal}>
            <Globe className="size-3.5 mr-1.5" />Public reveal: {reveal ? "ON" : "OFF"}
          </Button>
        </div>
      </div>

      {applyState.message && (
        <div className={`px-4 py-2 text-[11.5px] border-b border-hairline ${
          applyState.status === "success" ? "text-stable" :
          applyState.status === "error" ? "text-emergency" : "text-muted-foreground"
        }`}>
          {applyState.status === "running" && <Loader2 className="size-3 inline mr-1.5 animate-spin" />}
          {applyState.status === "success" && <CheckCircle2 className="size-3 inline mr-1.5" />}
          {applyState.status === "error" && <AlertTriangle className="size-3 inline mr-1.5" />}
          {applyState.message}
        </div>
      )}

      <table className="w-full text-[12px]">
        <thead className="text-[10.5px] mono uppercase tracking-[0.18em] text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2">Role</th>
            <th className="text-left">Email</th>
            <th className="text-left">Password</th>
            <th className="text-left">Lands on</th>
            <th className="text-right pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {!rows && (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground"><Loader2 className="size-3.5 inline animate-spin mr-1.5" />Loading…</td></tr>
          )}
          {rows?.map((r) => {
            return (
              <tr key={r.email} className="border-t border-hairline/60">
                <td className="px-4 py-1.5 font-semibold">{r.role_label}</td>
                <td className="mono">
                  <button onClick={() => copy(r.email, "Email")} className="hover:text-action inline-flex items-center gap-1">
                    {r.email}<Copy className="size-3 opacity-60" />
                  </button>
                </td>
                <td className="mono">
                  <button onClick={() => copy(r.password, "Password")} className="hover:text-action inline-flex items-center gap-1">
                    {show ? r.password : "••••••••••••"}<Copy className="size-3 opacity-60" />
                  </button>
                </td>
                <td className="mono text-muted-foreground">{r.lands_on}</td>
                <td className="pr-4 text-right whitespace-nowrap">
                  <button onClick={() => doRotateOne(r.email)} disabled={busy === r.email} className="px-2 h-6 rounded border border-hairline mono text-[10px] uppercase tracking-widest inline-flex items-center gap-1 hover:bg-panel mr-1.5">
                    <RefreshCw className={`size-3 ${busy === r.email ? "animate-spin" : ""}`} />Gen
                  </button>
                  <button type="button" onClick={() => launchWithAutofill(r)} className="px-2 h-6 rounded bg-action text-action-foreground mono text-[10px] uppercase tracking-widest inline-flex items-center gap-1">
                    <LogIn className="size-3" />Sign in
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
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