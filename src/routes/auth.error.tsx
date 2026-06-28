import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, LifeBuoy, RefreshCcw } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/auth/error")({
  validateSearch: z.object({
    code: z.string().optional(),
    attempt: z.string().optional(),
    as: z.enum(["patient", "provider", "org"]).optional(),
    message: z.string().optional(),
  }),
  head: () => ({ meta: [{ title: "Sign-in error · VeloMed OS" }] }),
  component: OAuthErrorPage,
});

const EXPLAINERS: Record<string, { title: string; body: string; steps: string[] }> = {
  access_denied: {
    title: "You cancelled Google sign-in",
    body: "The Google consent screen was closed before sign-in finished. No account changes were made.",
    steps: ["Click Retry below to try again.", "On the consent screen, choose your account and tap Continue."],
  },
  missing_email: {
    title: "Google didn't share your email",
    body: "We need the email scope to identify your VeloMed account.",
    steps: ["Retry sign-in.", "When prompted, keep the email permission checked.", "If the problem repeats, sign in with a different Google account."],
  },
  invalid_client: {
    title: "Google sign-in misconfigured",
    body: "Google rejected our OAuth client. This is a configuration issue on our side.",
    steps: ["Contact support@velomedos.com with the diagnostic ID below.", "Mention error code OAUTH_CLIENT."],
  },
  redirect_uri_mismatch: {
    title: "Sign-in destination blocked",
    body: "The redirect URL is not whitelisted in our Google OAuth client.",
    steps: ["Contact support@velomedos.com with code OAUTH_REDIRECT.", "Include the diagnostic ID below."],
  },
  role_not_provisioned: {
    title: "Your account isn't provisioned for this portal",
    body: "Your Google identity isn't linked to a profile with the role you chose.",
    steps: ["Ask your superadmin to grant access.", "Or pick a different account type and try again."],
  },
  network: {
    title: "Network error",
    body: "We couldn't reach Google.",
    steps: ["Check your internet connection.", "Disable any VPN or ad blocker that might block accounts.google.com.", "Retry."],
  },
  unknown: {
    title: "Sign-in failed",
    body: "Something unexpected happened during Google sign-in.",
    steps: ["Retry sign-in.", "If it keeps failing, contact support@velomedos.com with the diagnostic ID below."],
  },
};

function OAuthErrorPage() {
  const { code, attempt, as, message } = useSearch({ from: "/auth/error" });
  const explainer = EXPLAINERS[code ?? "unknown"] ?? EXPLAINERS.unknown;
  const retryHref = as ? `/auth?as=${as}` : "/auth";
  return (
    <div className="min-h-screen bg-background text-foreground grid place-items-center p-6">
      <div className="max-w-lg w-full space-y-6">
        <Link to="/auth" className="mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="size-3" /> Back to sign-in
        </Link>
        <div className="rounded-2xl border border-emergency/40 bg-emergency/10 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-md bg-emergency/20 text-emergency grid place-items-center"><AlertTriangle className="size-5" /></div>
            <div>
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-emergency">OAuth · Google</div>
              <h1 className="text-xl font-bold tracking-tight">{explainer.title}</h1>
            </div>
          </div>
          <p className="text-sm text-foreground/80">{explainer.body}</p>
          {message && (
            <pre className="mono text-[10px] bg-panel border border-hairline rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-words text-muted-foreground">{message}</pre>
          )}
          <div className="space-y-1.5">
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Next steps</div>
            <ol className="list-decimal list-inside text-sm text-foreground/80 space-y-1">
              {explainer.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link to={retryHref} className="h-10 rounded-md bg-emergency text-emergency-foreground mono text-xs uppercase tracking-widest font-bold inline-flex items-center justify-center gap-2 hover:bg-emergency/90">
              <RefreshCcw className="size-3.5" /> Retry sign-in
            </Link>
            <a href="mailto:support@velomedos.com" className="h-10 rounded-md border border-hairline bg-panel hover:bg-panel-elevated mono text-xs uppercase tracking-widest inline-flex items-center justify-center gap-2">
              <LifeBuoy className="size-3.5" /> Contact support
            </a>
          </div>
          <div className="mono text-[10px] text-muted-foreground space-y-0.5">
            <div>Diagnostic ID: <span className="text-foreground/80">{attempt ?? "—"}</span></div>
            <div>Code: <span className="text-foreground/80">{code ?? "unknown"}</span></div>
            <div>Audience: <span className="text-foreground/80">{as ?? "—"}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}