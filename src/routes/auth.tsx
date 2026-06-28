import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Activity } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ mode: z.enum(["signin", "signup"]).optional() }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { mode: initMode } = useSearch({ from: "/auth" });
  const [mode] = useState<"signin" | "signup">("signin");
  void initMode;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const dest = await destinationForUser(data.user.id, data.user.email);
        navigate({ to: dest, replace: true });
      }
    });
  }, [navigate]);

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
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth`,
    });
    if (result.error) { toast.error(result.error.message); return; }
    if (result.redirected) return;
    const { data } = await supabase.auth.getUser();
    const dest = data.user ? await destinationForUser(data.user.id, data.user.email) : "/patient";
    navigate({ to: dest, replace: true });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background text-foreground">
      <div className="hidden lg:flex flex-col justify-between p-10 border-r border-hairline bg-panel">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-emergency grid place-items-center text-emergency-foreground"><Activity className="size-4" /></div>
          <span className="font-bold tracking-tight">VELOMED <span className="text-emergency">OS</span></span>
        </Link>
        <div className="space-y-4 max-w-md">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-action">Operations terminal</div>
          <h2 className="text-3xl font-bold leading-tight">"Sub-six-minute median en-route, every shift."</h2>
          <p className="text-sm text-muted-foreground">VeloMed OS routes calls, fleets, paramedics, patients and developers through one nervous system.</p>
        </div>
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-stable animate-pulse" /> All systems nominal
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1.5">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Authenticate</div>
            <h1 className="text-2xl font-bold tracking-tight">Sign in to VeloMed</h1>
            <p className="text-[11px] text-muted-foreground">Operator access is provisioned by your superadmin. No public sign-up.</p>
          </div>
          <button onClick={google} type="button" className="w-full h-10 rounded-md border border-hairline bg-panel hover:bg-panel-elevated mono text-xs uppercase tracking-widest flex items-center justify-center gap-2">
            Continue with Google
          </button>
          <div className="flex items-center gap-3 mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <div className="h-px flex-1 bg-hairline" />or<div className="h-px flex-1 bg-hairline" />
          </div>
          <form onSubmit={submit} className="space-y-3">
            {false && <input value={name} onChange={(e) => setName(e.target.value)} className="hidden" />}
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hospital.org" className="w-full h-10 px-3 rounded-md bg-input border border-hairline focus:border-action outline-none text-sm" />
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full h-10 px-3 rounded-md bg-input border border-hairline focus:border-action outline-none text-sm" />
            <button disabled={loading} className="w-full h-10 rounded-md bg-emergency text-emergency-foreground mono text-xs uppercase tracking-widest font-bold hover:bg-emergency/90 disabled:opacity-60">
              {loading ? "..." : "Sign in"}
            </button>
          </form>
          <div className="text-center text-[11px] text-muted-foreground">
            Forgot your password? Ask your superadmin to reset it. <Link to="/superadmin/login" className="text-action hover:underline">Superadmin sign-in →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}