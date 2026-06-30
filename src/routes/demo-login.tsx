import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LogIn, Eye, EyeOff, Copy, ShieldAlert, ExternalLink } from "lucide-react";
import { BrandMark, BrandWordmark } from "@/components/BrandMark";
import { clinicalDestinationFor } from "@/lib/clinical-role-landing";

/**
 * /demo-login — single-card sign-in for the VeloMed sandbox.
 *
 * 3 fields: role selector · username · password. Pick a role and both fields
 * auto-fill from the public demo credentials API (when public reveal is on).
 * Optional `?role=physician&autosignin=1` for one-click links.
 */

type Acct = {
  email: string;
  role_label: string;
  clinical_role: string | null;
  lands_on: string;
  password?: string;
};

type DemoState = { reveal: boolean; accounts: Acct[] };

export const Route = createFileRoute("/demo-login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Demo sign-in · VeloMed OS sandbox" },
      { name: "description", content: "Pick a role, sign in to the VeloMed OS sandbox. Pre-seeded accounts for HIS, RCM, dispatch, and patient apps." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DemoLogin,
});

function roleKey(a: Acct): string {
  return a.clinical_role || a.email.split("@")[0];
}

function DemoLogin() {
  const navigate = useNavigate();
  const [state, setState] = useState<DemoState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/public/v1/demo/credentials", { credentials: "omit" });
        const j = (await r.json()) as { ok: boolean; reveal?: boolean; accounts?: Acct[]; error?: string };
        if (!j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        setState({ reveal: Boolean(j.reveal), accounts: j.accounts ?? [] });
      } catch (e) {
        setLoadError((e as Error).message);
      }
    })();
  }, []);

  // Apply URL preselection once the roster loads
  useEffect(() => {
    if (!state) return;
    const url = new URL(window.location.href);
    const want = url.searchParams.get("role");
    if (want) {
      const match =
        state.accounts.find((a) => roleKey(a) === want) ||
        state.accounts.find((a) => a.email.split("@")[0] === want);
      if (match) chooseRole(roleKey(match), state);
      if (url.searchParams.get("autosignin") === "1" && match?.password) {
        // give state a tick to settle
        setTimeout(() => signIn(match.email, match.password!, match), 50);
      }
    } else if (state.accounts.length) {
      const physician = state.accounts.find((a) => a.clinical_role === "physician") ?? state.accounts[0];
      chooseRole(roleKey(physician), state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function chooseRole(key: string, src: DemoState | null = state) {
    if (!src) return;
    const acct = src.accounts.find((a) => roleKey(a) === key);
    if (!acct) return;
    setSelected(key);
    setEmail(acct.email);
    setPassword(acct.password ?? "");
  }

  async function signIn(eml: string, pw: string, acct?: Acct) {
    if (!eml || !pw) {
      toast.error("Pick a role to auto-fill, or type a username and password.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: eml, password: pw });
      if (error) throw error;
      const target = acct ?? state?.accounts.find((a) => a.email === eml);
      let dest = target?.lands_on ?? "/clinical";
      if (dest === "/clinical" || dest.startsWith("/clinical?")) {
        dest = target?.clinical_role ? clinicalDestinationFor(target.clinical_role) : "/clinical";
      }
      toast.success(`Signed in as ${target?.role_label ?? eml}`);
      navigate({ to: dest, replace: true });
    } catch (e) {
      toast.error(`Sign-in failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Clipboard blocked");
    }
  }

  const selectedAcct = useMemo(
    () => state?.accounts.find((a) => roleKey(a) === selected),
    [state, selected],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-hairline">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5"><BrandMark className="size-7" /><BrandWordmark /></Link>
          <Link to="/auth" className="mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
            Real sign-in <ExternalLink className="size-3" />
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        <div className="space-y-1.5 text-center">
          <div className="mono text-[10px] uppercase tracking-[0.24em] text-caution inline-flex items-center gap-1.5 justify-center"><ShieldAlert className="size-3" />Sandbox · demo-hospital</div>
          <h1 className="text-2xl font-semibold tracking-tight">VeloMed sandbox — sign in</h1>
          <p className="text-[13px] text-muted-foreground">Pick a role, click Sign in. NPHIES · ZATCA · D365 run in stub mode.</p>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); signIn(email, password, selectedAcct); }}
          className="rounded-2xl border border-hairline bg-panel p-6 space-y-5"
        >
          {/* Role */}
          <Field label="Role">
            <select
              value={selected}
              onChange={(e) => chooseRole(e.target.value)}
              className="w-full h-11 px-3 rounded-md bg-input border border-hairline text-sm"
              disabled={!state}
            >
              {!state && <option>Loading sandbox accounts…</option>}
              {state?.accounts.map((a) => (
                <option key={a.email} value={roleKey(a)}>{a.role_label}</option>
              ))}
            </select>
          </Field>

          {/* Username */}
          <Field label="Username">
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="role@demo.velomedos.com"
                className="flex-1 h-11 px-3 rounded-md bg-input border border-hairline mono text-[13px]"
                autoComplete="username"
              />
              <button type="button" onClick={() => email && copy(email, "Email")} className="px-3 h-11 rounded-md border border-hairline inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-widest">
                <Copy className="size-3.5" />
              </button>
            </div>
          </Field>

          {/* Password */}
          <Field label="Password" hint={state && !state.reveal ? "Ask your operator to enable Public reveal in Superadmin → Demo Environment, or type the password manually." : undefined}>
            <div className="flex gap-2">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={state?.reveal ? "Auto-filled from sandbox" : "Type the demo password"}
                className="flex-1 h-11 px-3 rounded-md bg-input border border-hairline mono text-[13px]"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPw((s) => !s)} className="px-3 h-11 rounded-md border border-hairline inline-flex items-center" aria-label={showPw ? "Hide" : "Show"}>
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
              <button type="button" onClick={() => password && copy(password, "Password")} className="px-3 h-11 rounded-md border border-hairline inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-widest">
                <Copy className="size-3.5" />
              </button>
            </div>
          </Field>

          <button
            type="submit"
            disabled={busy || !email || !password}
            className="w-full h-11 rounded-md bg-action text-action-foreground font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogIn className="size-4" />
            {busy ? "Signing in…" : `Sign in${selectedAcct ? ` as ${selectedAcct.role_label}` : ""}`}
          </button>

          {selectedAcct && (
            <div className="text-[11px] text-muted-foreground text-center">
              You'll land on <span className="mono text-foreground">{selectedAcct.lands_on}</span>
            </div>
          )}
        </form>

        {loadError && (
          <div className="rounded-md border border-emergency/40 bg-emergency/5 px-4 py-3 text-[12px] text-emergency">
            Couldn't load sandbox accounts: {loadError}
          </div>
        )}

        <div className="text-center text-[12px] text-muted-foreground space-x-3">
          <Link to="/demo-credentials" className="text-action underline">See all 13 accounts</Link>
          <span>·</span>
          <Link to="/" className="hover:text-foreground">Back to site</Link>
        </div>
      </main>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </label>
  );
}