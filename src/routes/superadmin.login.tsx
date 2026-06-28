import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapSuperadmin, SUPERADMIN_EMAIL } from "@/lib/superadmin.functions";
import { Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/superadmin/login")({
  head: () => ({ meta: [{ title: "Superadmin sign-in · VeloMed OS" }] }),
  component: SuperadminLogin,
});

function SuperadminLogin() {
  const navigate = useNavigate();
  const boot = useServerFn(bootstrapSuperadmin);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootState, setBootState] = useState<"idle" | "ok" | "error">("idle");
  const [bootMsg, setBootMsg] = useState<string | null>(null);

  useEffect(() => {
    // Idempotent bootstrap so first install has a working superadmin.
    boot()
      .then((r) => {
        if (r.ok) {
          setBootState("ok");
          if (r.created) setBootMsg("Superadmin provisioned with the project secret.");
        } else {
          setBootState("error");
          setBootMsg(r.error);
        }
      })
      .catch((e) => { setBootState("error"); setBootMsg((e as Error).message); });

    // If already signed in as superadmin, go straight in.
    supabase.auth.getUser().then(({ data }) => {
      if (data.user && (data.user.email ?? "").toLowerCase() === SUPERADMIN_EMAIL) {
        navigate({ to: "/superadmin", replace: true });
      }
    });
  }, [boot, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: SUPERADMIN_EMAIL,
        password,
      });
      if (error) throw error;
      toast.success("Signed in as superadmin");
      navigate({ to: "/superadmin", replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
      <div className="w-full max-w-sm space-y-6 border border-hairline bg-panel rounded-xl p-6">
        <div className="flex items-center gap-2">
          <div className="size-9 grid place-items-center rounded-lg bg-teal/15 text-teal"><Shield className="size-4" /></div>
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal">VeloMed Control Plane</div>
            <div className="font-semibold">Superadmin sign-in</div>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground">
          Identity locked to <span className="mono">{SUPERADMIN_EMAIL}</span>. Password is the project
          secret <span className="mono">SUPERADMIN_SECRET</span> until you change it.
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            value={SUPERADMIN_EMAIL}
            readOnly
            className="w-full h-10 px-3 rounded-md bg-input/60 border border-hairline mono text-[12px] text-muted-foreground"
          />
          <input
            type="password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Superadmin password"
            className="w-full h-10 px-3 rounded-md bg-input border border-hairline focus:border-teal outline-none text-sm"
          />
          <button
            disabled={loading || bootState === "error"}
            className="w-full h-10 rounded-md bg-teal text-background mono text-xs uppercase tracking-widest font-bold hover:bg-teal/90 disabled:opacity-60"
          >
            {loading ? "..." : "Sign in"}
          </button>
        </form>
        <div className="flex items-center justify-between text-[11px]">
          <Link to="/superadmin/reset" className="text-teal hover:underline">Forgot password →</Link>
          <Link to="/auth" className="text-muted-foreground hover:text-foreground">Operator sign-in</Link>
        </div>
        {bootMsg && (
          <div className={`text-[10.5px] mono ${bootState === "error" ? "text-coral" : "text-stable"}`}>
            {bootState === "error" ? "BOOTSTRAP_FAILED · " : "BOOTSTRAP_OK · "}{bootMsg}
          </div>
        )}
      </div>
    </div>
  );
}
