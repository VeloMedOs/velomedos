import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useServerFn } from "@tanstack/react-start";
import { recordOAuthOutcome } from "@/lib/oauth-diagnostics.functions";
import { User, Stethoscope, Building2, ArrowLeft, AlertTriangle, CheckCircle2, ExternalLink, ArrowRight } from "lucide-react";
import { BrandMark, BrandWordmark } from "@/components/BrandMark";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({
    mode: z.enum(["signin", "signup"]).optional(),
    as: z.enum(["patient", "provider", "org"]).optional(),
    err: z.string().optional(),
    attempt: z.string().optional(),
  }),
  component: AuthPage,
});

type Audience = "patient" | "provider" | "org";
const ATTEMPT_KEY = "velomed:oauth_attempt";
const ROLE_KEY = "velomed:intended_role";

const AUDIENCES: { id: Audience; title: string; tagline: string; icon: typeof User; allowedRoles: string[] }[] = [
  { id: "patient", title: "Patient", tagline: "Track your care, request an ambulance, share your trip.", icon: User, allowedRoles: ["patient"] },
  { id: "provider", title: "Provider / Paramedic", tagline: "Paramedics and drivers on shift. Credentials issued by your operator.", icon: Stethoscope, allowedRoles: ["paramedic", "driver", "dispatcher", "admin"] },
  { id: "org", title: "Organisation admin", tagline: "Hospitals, fleets and corporate accounts managing rosters.", icon: Building2, allowedRoles: ["business_admin", "admin", "superadmin"] },
];

const ERROR_COPY: Record<string, { title: string; body: string; outcome: "cancelled" | "missing_email" | "invalid_client" | "role_not_provisioned" | "network_error" | "unknown_error" }> = {
  access_denied: { title: "Sign-in cancelled", body: "You closed the Google consent screen before finishing.", outcome: "cancelled" },
  missing_email: { title: "Google didn't share an email", body: "We need the email scope to identify your account. Try again and accept the email permission.", outcome: "missing_email" },
  invalid_client: { title: "Google sign-in misconfigured", body: "Our Google OAuth client rejected the request. Contact support with code OAUTH_CLIENT.", outcome: "invalid_client" },
  redirect_uri_mismatch: { title: "Sign-in destination blocked", body: "The redirect URL isn't whitelisted in Google. Contact support with code OAUTH_REDIRECT.", outcome: "invalid_client" },
  role_not_provisioned: { title: "Account not provisioned", body: "Your Google account isn't linked to a profile for this portal. Ask your superadmin to grant access, or sign in with a different audience.", outcome: "role_not_provisioned" },
  network: { title: "Network error", body: "We couldn't reach Google. Check your connection and try again.", outcome: "network_error" },
  unknown: { title: "Sign-in failed", body: "Something went wrong. Try again or contact support with the diagnostic ID below.", outcome: "unknown_error" },
};

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [mode] = useState<"signin" | "signup">("signin");
  const [audience, setAudience] = useState<Audience | null>(search.as ?? null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthError, setOauthError] = useState<{ code: string; attempt: string | null } | null>(
    search.err ? { code: search.err, attempt: search.attempt ?? null } : null,
  );
  const record = useServerFn(recordOAuthOutcome);

  useEffect(() => {
    if (audience) try { sessionStorage.setItem(ROLE_KEY, audience); } catch { /* noop */ }
  }, [audience]);

  async function destinationForUser(userId: string, email: string | null | undefined): Promise<string> {
    try {
      const saved = sessionStorage.getItem("velomed:post_auth");
      if (saved && saved.startsWith("/")) { sessionStorage.removeItem("velomed:post_auth"); return saved; }
    } catch { /* noop */ }
    if ((email ?? "").toLowerCase() === "superadmin@velomedos.com") return "/superadmin";
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = new Set((data ?? []).map((r: { role: string }) => r.role));
    if (roles.has("superadmin")) return "/superadmin";
    if (roles.has("admin") || roles.has("dispatcher") || roles.has("business_admin")) return "/dispatch";
    if (roles.has("paramedic") || roles.has("driver")) return "/provider";
    return "/patient";
  }

  async function rolesFor(userId: string): Promise<string[]> {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    return (data ?? []).map((r: { role: string }) => r.role);
  }

  useEffect(() => {
    // Handle returning from Google OAuth.
    let attemptId: string | null = null;
    try { attemptId = sessionStorage.getItem(ATTEMPT_KEY); } catch { /* noop */ }
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const hashError = hash.includes("error=") ? new URLSearchParams(hash.slice(1)).get("error") : null;
    if (hashError) {
      const mapped = hashError === "access_denied" ? "access_denied" : "unknown";
      setOauthError({ code: mapped, attempt: attemptId });
      if (attemptId) {
        record({ data: { attemptId, outcome: ERROR_COPY[mapped].outcome, code: hashError } }).catch(() => {});
      }
      try { sessionStorage.removeItem(ATTEMPT_KEY); } catch { /* noop */ }
      window.history.replaceState({}, "", "/auth");
      return;
    }

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const intended = (sessionStorage.getItem(ROLE_KEY) as Audience | null) ?? audience ?? null;
      const roles = await rolesFor(data.user.id);
      const aud = intended ? AUDIENCES.find((a) => a.id === intended) : null;
      const matches = !aud || aud.allowedRoles.some((r) => roles.includes(r)) || aud.id === "patient";
      if (!matches) {
        setOauthError({ code: "role_not_provisioned", attempt: attemptId });
        if (attemptId) {
          record({ data: { attemptId, outcome: "role_not_provisioned", intendedRole: intended ?? undefined, resolvedRole: roles[0], email: data.user.email ?? undefined } }).catch(() => {});
        }
        await supabase.auth.signOut();
        return;
      }
      if (attemptId) {
        record({ data: { attemptId, outcome: "success", intendedRole: intended ?? undefined, resolvedRole: roles[0], email: data.user.email ?? undefined } }).catch(() => {});
        try { sessionStorage.removeItem(ATTEMPT_KEY); } catch { /* noop */ }
      }
      const dest = await destinationForUser(data.user.id, data.user.email);
      navigate({ to: dest, replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim().toLowerCase() === "superadmin@velomedos.com") {
      navigate({ to: "/superadmin/login", replace: true });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back.");
      const dest = data.user ? await destinationForUser(data.user.id, data.user.email) : "/patient";
      navigate({ to: dest, replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const attemptId = (typeof crypto !== "undefined" && "randomUUID" in crypto)
      ? crypto.randomUUID()
      : `att_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    try {
      sessionStorage.setItem(ATTEMPT_KEY, attemptId);
      if (audience) sessionStorage.setItem(ROLE_KEY, audience);
    } catch { /* noop */ }
    record({ data: { attemptId, outcome: "started", intendedRole: audience ?? undefined } }).catch(() => {});
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth`,
      });
      const redirectUri = `${window.location.origin}/auth`;
      if (result.error) {
        const code = (result.error.message || "").toLowerCase().includes("client") ? "invalid_client" : "unknown";
        setOauthError({ code, attempt: attemptId });
        record({ data: { attemptId, outcome: ERROR_COPY[code].outcome, code: result.error.message, intendedRole: audience ?? undefined, redirectUri, scopes: "openid email profile", referrer: document.referrer || undefined } }).catch(() => {});
        return;
      }
      if (result.redirected) return;
      const { data } = await supabase.auth.getUser();
      if (!data.user?.email) {
        setOauthError({ code: "missing_email", attempt: attemptId });
        record({ data: { attemptId, outcome: "missing_email", intendedRole: audience ?? undefined } }).catch(() => {});
        await supabase.auth.signOut();
        return;
      }
      const roles = data.user ? await rolesFor(data.user.id) : [];
      const aud = audience ? AUDIENCES.find((a) => a.id === audience) : null;
      const matches = !aud || aud.allowedRoles.some((r) => roles.includes(r)) || aud.id === "patient";
      if (!matches) {
        setOauthError({ code: "role_not_provisioned", attempt: attemptId });
        record({ data: { attemptId, outcome: "role_not_provisioned", intendedRole: audience ?? undefined, resolvedRole: roles[0], email: data.user.email } }).catch(() => {});
        await supabase.auth.signOut();
        return;
      }
      record({ data: { attemptId, outcome: "success", intendedRole: audience ?? undefined, resolvedRole: roles[0], email: data.user.email } }).catch(() => {});
      const dest = data.user ? await destinationForUser(data.user.id, data.user.email) : "/patient";
      navigate({ to: dest, replace: true });
    } catch (err) {
      setOauthError({ code: "network", attempt: attemptId });
      record({ data: { attemptId, outcome: "network_error", code: (err as Error).message, intendedRole: audience ?? undefined } }).catch(() => {});
    }
  }

  const errorView = useMemo(() => {
    if (!oauthError) return null;
    const e = ERROR_COPY[oauthError.code] ?? ERROR_COPY.unknown;
    return (
      <div className="rounded-xl border p-3.5 text-[12px] space-y-1.5" style={{ borderColor: "oklch(0.725 0.181 27 / 0.45)", background: "linear-gradient(180deg, oklch(0.725 0.181 27 / 0.10), oklch(0.725 0.181 27 / 0.04))" }}>
        <div className="flex items-center gap-2 font-semibold" style={{ color: "var(--coral)" }}><AlertTriangle className="size-4" />{e.title}</div>
        <div className="text-foreground/80">{e.body}</div>
        {oauthError.attempt && <div className="mono text-[10px] text-muted-foreground">Diagnostic ID: {oauthError.attempt}</div>}
        <div className="flex items-center gap-3 pt-1">
          <Link to="/auth/error" search={{ code: oauthError.code, attempt: oauthError.attempt ?? undefined, as: audience ?? undefined }} className="mono text-[10px] uppercase tracking-widest hover:underline inline-flex items-center gap-1" style={{ color: "var(--teal)" }}>
            View details <ExternalLink className="size-3" />
          </Link>
          <button onClick={() => setOauthError(null)} className="mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">Dismiss</button>
        </div>
      </div>
    );
  }, [oauthError, audience]);

  // STEP 1 — audience chooser (no audience selected)
  if (!audience) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 flex flex-col relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 brand-wash pointer-events-none" />
        <div aria-hidden className="absolute inset-0 grid-mesh pointer-events-none" />
        <header className="flex items-center justify-between max-w-5xl mx-auto w-full relative z-10">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark className="size-7" />
            <BrandWordmark />
          </Link>
          <Link to="/" className="mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="size-3" /> Home</Link>
        </header>
        <main id="main" className="flex-1 grid place-items-center relative z-10">
          <div className="max-w-3xl w-full text-center space-y-8 pt-10">
            <div className="space-y-3">
              <div className="brand-eyebrow justify-center"><span className="vital-dot" /> Sign in · Sign up</div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight" style={{ fontFamily: "Fraunces, Georgia, serif" }}>Choose your account type</h1>
              <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">Select Patient if you're seeking care, Provider if you respond on shift, or Organisation admin if you manage a fleet or hospital roster.</p>
              <div className="signal-bar max-w-[260px] mx-auto mt-4" />
            </div>
            {errorView}
            <div className="grid md:grid-cols-3 gap-4 text-left">
              {AUDIENCES.map((a) => (
                <button key={a.id} onClick={() => { setAudience(a.id); navigate({ to: "/auth", search: { as: a.id }, replace: true }); }} className="group instrument-panel p-5 text-left hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden">
                  <span aria-hidden className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "var(--gradient-brand)" }} />
                  <div className="size-10 rounded-lg grid place-items-center mb-4 relative" style={{ background: "var(--gradient-brand-soft)" }}>
                    <a.icon className="size-5" style={{ color: "var(--teal)" }} />
                  </div>
                  <div className="font-semibold text-lg tracking-tight">{a.title}</div>
                  <div className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{a.tagline}</div>
                  <div className="mono text-[10px] uppercase tracking-widest mt-5 inline-flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: "var(--teal)" }}>Continue <ArrowRight className="size-3" /></div>
                </button>
              ))}
            </div>
            <div className="text-[12px] text-muted-foreground">
              New organisation? <Link to="/business-intake" className="font-medium hover:underline" style={{ color: "var(--teal)" }}>Apply for access</Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const aud = AUDIENCES.find((a) => a.id === audience)!;

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background text-foreground">
      <div className="hidden lg:flex flex-col justify-between p-10 border-r border-hairline relative overflow-hidden" style={{ background: "var(--gradient-instrument)" }}>
        <div aria-hidden className="absolute inset-0 brand-wash pointer-events-none" />
        <div aria-hidden className="absolute inset-0 grid-mesh pointer-events-none" />
        <div aria-hidden className="absolute -top-24 -left-24 size-96 rounded-full blur-3xl opacity-25 pointer-events-none" style={{ background: "var(--gradient-brand)" }} />
        <div aria-hidden className="absolute -bottom-32 -right-20 size-80 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: "var(--coral)" }} />
        <Link to="/" className="flex items-center gap-2.5 relative z-10">
          <BrandMark className="size-7" />
          <BrandWordmark />
        </Link>
        <div className="space-y-5 max-w-md relative z-10">
          <div className="brand-eyebrow"><span className="vital-dot" /> {aud.title} access</div>
          <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight" style={{ fontFamily: "Fraunces, Georgia, serif" }}>
            {audience === "patient" ? "Your care, on the map." : audience === "provider" ? "Sub-six-minute median en-route, every shift." : "One nervous system for your fleet."}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{audience === "patient" ? "Request an ambulance, follow it live, share your trip with family." : audience === "provider" ? "Live runsheet, paperless trip reports, fleet tracking from your phone." : "Roster, billing, training compliance and dispatch across every site."}</p>
          <div className="signal-bar max-w-[180px]" />
        </div>
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-2 relative z-10">
          <span className="vital-dot" /> All systems nominal · Encrypted channel
        </div>
      </div>
      <main id="main" className="flex items-center justify-center p-6 relative">
        <div aria-hidden className="absolute inset-0 brand-wash pointer-events-none lg:hidden" />
        <div className="w-full max-w-sm space-y-6">
          <button onClick={() => { setAudience(null); navigate({ to: "/auth", replace: true }); }} className="mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><ArrowLeft className="size-3" /> Change account type</button>
          <div className="lg:hidden flex items-center gap-2.5">
            <BrandMark className="size-7" />
            <BrandWordmark />
          </div>
          <div className="space-y-2">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Authenticate · <span style={{ color: "var(--teal)" }}>{aud.title}</span></div>
            <h1 className="text-3xl font-semibold tracking-tight leading-tight" style={{ fontFamily: "Fraunces, Georgia, serif" }}>{audience === "patient" ? "Sign in to your care record" : audience === "provider" ? "Sign in for shift" : "Sign in to your workspace"}</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">{audience === "patient" ? "Use Google or email to access your trips, records and shared links." : "Credentials are issued by your superadmin. Google works only for pre-provisioned accounts."}</p>
          </div>
          {errorView}
          <button onClick={google} type="button" className="w-full h-11 rounded-lg border border-hairline bg-panel/60 hover:bg-panel-elevated hover:border-hairline mono text-[11px] uppercase tracking-widest flex items-center justify-center gap-2.5 transition-colors backdrop-blur-sm">
            <GoogleGlyph /> Continue with Google
          </button>
          <div className="flex items-center gap-3 mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <div className="h-px flex-1 bg-hairline" />or<div className="h-px flex-1 bg-hairline" />
          </div>
          <form onSubmit={submit} className="space-y-3">
            <input aria-label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hospital.org" className="w-full h-11 px-3.5 rounded-lg bg-input/70 border border-hairline focus:border-transparent focus:ring-2 outline-none text-sm transition-all" style={{ ['--tw-ring-color' as string]: "var(--teal)" }} />
            <input aria-label="Password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full h-11 px-3.5 rounded-lg bg-input/70 border border-hairline focus:border-transparent focus:ring-2 outline-none text-sm transition-all" style={{ ['--tw-ring-color' as string]: "var(--teal)" }} />
            <button disabled={loading} className="w-full h-11 rounded-lg mono text-[11px] uppercase tracking-widest font-bold text-background hover:opacity-95 disabled:opacity-60 transition-all relative overflow-hidden group" style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-glow-teal)" }}>
              <span className="relative z-10 inline-flex items-center gap-2 justify-center">{loading ? "Signing in…" : mode === "signin" ? "Sign in" : "Continue"} {!loading && <ArrowRight className="size-3.5" />}</span>
              <span aria-hidden className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "linear-gradient(135deg, oklch(1 0 0 / 0.14), transparent)" }} />
            </button>
          </form>
          <div className="text-center text-[11px] text-muted-foreground">
            {audience === "patient"
              ? <>New here? Use <span style={{ color: "var(--teal)" }}>Continue with Google</span> to create your patient account.</>
              : <>Forgot your password? Ask your superadmin to reset it. <Link to="/superadmin/login" className="hover:underline" style={{ color: "var(--teal)" }}>Superadmin sign-in →</Link></>}
          </div>
          <div className="text-center text-[10px] text-muted-foreground flex items-center justify-center gap-1.5"><CheckCircle2 className="size-3" style={{ color: "var(--teal)" }} /> Encrypted sign-in · audit-logged · KSA PDPL</div>
        </div>
      </main>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"/>
      <path fill="#34A853" d="M3.6 7.5l3.2 2.3C7.6 7.9 9.6 6.4 12 6.4c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 8.2 2.4 4.9 4.5 3.6 7.5z" opacity="0"/>
      <path fill="#4285F4" d="M21.2 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.5c-.2 1.3-1.1 2.4-2.4 3.1l3.6 2.8c2.1-1.9 3.5-4.8 3.5-8.2z" opacity="0"/>
    </svg>
  );
}