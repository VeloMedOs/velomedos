import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { SUPERADMIN_EMAIL, resetSuperadminToSecret } from "@/lib/superadmin.functions";
import { Shield, Mail, KeyRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/superadmin/reset")({
  head: () => ({ meta: [{ title: "Superadmin password reset · VeloMed OS" }] }),
  component: SuperadminReset,
});

function SuperadminReset() {
  const navigate = useNavigate();
  const resetToSecret = useServerFn(resetSuperadminToSecret);
  const [hasRecovery, setHasRecovery] = useState(false);
  const [sending, setSending] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [updating, setUpdating] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Supabase deposits a `?type=recovery` (or hash fragment) when the user
  // clicks the recovery email link. Detect the active recovery session.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setHasRecovery(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      const url = new URL(window.location.href);
      const isRecovery = url.searchParams.get("type") === "recovery" || url.hash.includes("type=recovery");
      if (data.session && isRecovery) setHasRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function sendCode() {
    setSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(SUPERADMIN_EMAIL, {
        redirectTo: `${window.location.origin}/superadmin/reset`,
      });
      if (error) throw error;
      toast.success(`Verification email sent to ${SUPERADMIN_EMAIL}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function updatePw(e: React.FormEvent) {
    e.preventDefault();
    setUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      toast.success("Password updated. Signing you in…");
      await supabase.auth.signOut();
      navigate({ to: "/superadmin/login", replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUpdating(false);
    }
  }

  async function restoreFromSecret() {
    setRestoring(true);
    try {
      const r = await resetToSecret();
      if (!r.ok) throw new Error(r.error);
      toast.success("Password restored to SUPERADMIN_SECRET. Use it to sign in.");
      navigate({ to: "/superadmin/login", replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
      <div className="w-full max-w-md space-y-6 border border-hairline bg-panel rounded-xl p-6">
        <div className="flex items-center gap-2">
          <div className="size-9 grid place-items-center rounded-lg bg-teal/15 text-teal"><Shield className="size-4" /></div>
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal">Superadmin recovery</div>
            <div className="font-semibold">Reset password</div>
          </div>
        </div>

        {!hasRecovery ? (
          <>
            <p className="text-[12px] text-muted-foreground">
              We&apos;ll email a verification link to <span className="mono">{SUPERADMIN_EMAIL}</span>.
              Open it on this device to set a new password.
            </p>
            <button
              onClick={sendCode}
              disabled={sending}
              className="w-full h-10 rounded-md bg-teal text-background mono text-xs uppercase tracking-widest font-bold hover:bg-teal/90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Mail className="size-3.5" /> {sending ? "Sending…" : "Email verification link"}
            </button>

            <div className="border-t border-hairline pt-4 space-y-2">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Lost mailbox access?</div>
              <p className="text-[11px] text-muted-foreground">
                Anyone holding the project secret <span className="mono">SUPERADMIN_SECRET</span> can
                restore the password back to that value, then sign in and rotate it.
              </p>
              <button
                onClick={restoreFromSecret}
                disabled={restoring}
                className="w-full h-9 rounded-md border border-hairline hover:bg-panel-elevated mono text-[11px] uppercase tracking-widest disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <KeyRound className="size-3.5" /> {restoring ? "Restoring…" : "Restore to SUPERADMIN_SECRET"}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={updatePw} className="space-y-3">
            <p className="text-[12px] text-muted-foreground">
              Recovery session detected. Enter a new password for <span className="mono">{SUPERADMIN_EMAIL}</span>.
            </p>
            <input
              type="password"
              required
              minLength={12}
              autoFocus
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="New password (min 12 chars)"
              className="w-full h-10 px-3 rounded-md bg-input border border-hairline focus:border-teal outline-none text-sm"
            />
            <button
              disabled={updating}
              className="w-full h-10 rounded-md bg-teal text-background mono text-xs uppercase tracking-widest font-bold hover:bg-teal/90 disabled:opacity-60"
            >
              {updating ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}

        <div className="text-center text-[11px]">
          <Link to="/superadmin/login" className="text-muted-foreground hover:text-foreground">← Back to sign-in</Link>
        </div>
      </div>
    </div>
  );
}
