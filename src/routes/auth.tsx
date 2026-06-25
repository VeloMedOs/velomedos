import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  const [mode, setMode] = useState<"signin" | "signup">(initMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dispatch", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dispatch`, data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("Account created. You're in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
      }
      navigate({ to: "/dispatch", replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dispatch` },
    });
    if (error) toast.error(error.message);
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
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{mode === "signin" ? "Authenticate" : "Provision account"}</div>
            <h1 className="text-2xl font-bold tracking-tight">{mode === "signin" ? "Sign in to VeloMed" : "Create your VeloMed account"}</h1>
          </div>
          <button onClick={google} type="button" className="w-full h-10 rounded-md border border-hairline bg-panel hover:bg-panel-elevated mono text-xs uppercase tracking-widest flex items-center justify-center gap-2">
            Continue with Google
          </button>
          <div className="flex items-center gap-3 mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <div className="h-px flex-1 bg-hairline" />or<div className="h-px flex-1 bg-hairline" />
          </div>
          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full h-10 px-3 rounded-md bg-input border border-hairline focus:border-action outline-none text-sm" />
            )}
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hospital.org" className="w-full h-10 px-3 rounded-md bg-input border border-hairline focus:border-action outline-none text-sm" />
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full h-10 px-3 rounded-md bg-input border border-hairline focus:border-action outline-none text-sm" />
            <button disabled={loading} className="w-full h-10 rounded-md bg-emergency text-emergency-foreground mono text-xs uppercase tracking-widest font-bold hover:bg-emergency/90 disabled:opacity-60">
              {loading ? "..." : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
          <div className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>No account? <button className="text-action hover:underline" onClick={() => setMode("signup")}>Sign up</button></>
            ) : (
              <>Already have one? <button className="text-action hover:underline" onClick={() => setMode("signin")}>Sign in</button></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}