import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, LogIn, ShieldAlert, ExternalLink, Stethoscope } from "lucide-react";
import { BrandMark, BrandWordmark } from "@/components/BrandMark";

/**
 * /demo-credentials — full roster reference page. Each row shows the
 * email, role, landing destination, and (when public reveal is on) the
 * password. Sign-in delegates to /demo-login?role=...&autosignin=1 so the
 * actual auth flow lives in one place.
 */

type Acct = {
  email: string;
  role_label: string;
  clinical_role: string | null;
  lands_on: string;
  password?: string;
};

type State = { reveal: boolean; accounts: Acct[] };

export const Route = createFileRoute("/demo-credentials")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Demo credentials · VeloMed OS sandbox" },
      { name: "description", content: "All 13 VeloMed sandbox accounts — emails, roles, landing destinations, and one-click sign-in." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DemoCredentialsPage,
});

function roleKey(a: Acct) {
  return a.clinical_role || a.email.split("@")[0];
}

function DemoCredentialsPage() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/public/v1/demo/credentials", { credentials: "omit" });
        const j = (await r.json()) as { ok: boolean; reveal?: boolean; accounts?: Acct[]; error?: string };
        if (!j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        setState({ reveal: Boolean(j.reveal), accounts: j.accounts ?? [] });
      } catch (e) { setError((e as Error).message); }
    })();
  }, []);

  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copied`); }
    catch { toast.error("Clipboard blocked"); }
  }

  function copyAllMarkdown() {
    if (!state) return;
    const lines: string[] = [];
    lines.push(`# VeloMed sandbox credentials`);
    lines.push(`Tenant: demo-hospital · Public reveal: ${state.reveal ? "ON" : "OFF"}`);
    lines.push(``);
    lines.push(`| Role | Email | Password | Lands on |`);
    lines.push(`| --- | --- | --- | --- |`);
    for (const a of state.accounts) {
      lines.push(`| ${a.role_label} | \`${a.email}\` | ${a.password ? `\`${a.password}\`` : "_hidden_"} | \`${a.lands_on}\` |`);
    }
    copy(lines.join("\n"), "Roster markdown");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-hairline">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5"><BrandMark className="size-7" /><BrandWordmark /></Link>
          <Link to="/demo-login" className="mono text-[10px] uppercase tracking-widest text-action inline-flex items-center gap-1.5">
            Open sandbox sign-in <ExternalLink className="size-3" />
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-caution inline-flex items-center gap-1.5"><ShieldAlert className="size-3" />Sandbox · demo-hospital</div>
            <h1 className="text-2xl font-semibold tracking-tight mt-1">All sandbox accounts</h1>
            <p className="text-[13px] text-muted-foreground max-w-2xl">13 pre-seeded accounts covering Clinical, RCM, Cash &amp; Finance, Audit, and Patient flows. Sign in lands each role on its primary HIS section.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAll((s) => !s)} className="px-3 h-9 rounded-md border border-hairline mono text-[10px] uppercase tracking-widest inline-flex items-center gap-1.5">
              {showAll ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}{showAll ? "Hide" : "Reveal"} passwords
            </button>
            <button onClick={copyAllMarkdown} className="px-3 h-9 rounded-md bg-action text-action-foreground mono text-[10px] uppercase tracking-widest inline-flex items-center gap-1.5">
              <Copy className="size-3.5" />Copy all as markdown
            </button>
          </div>
        </div>

        {state && !state.reveal && (
          <div className="rounded-md border border-caution/40 bg-caution/5 px-4 py-3 text-[12px] text-caution">
            Public reveal is OFF — passwords are hidden. A platform operator can enable it from <span className="mono">/superadmin → Demo Environment → Public reveal</span>.
          </div>
        )}

        {error && (
          <div className="rounded-md border border-emergency/40 bg-emergency/5 px-4 py-3 text-[12px] text-emergency">
            Couldn't load accounts: {error}
          </div>
        )}

        <section className="rounded-2xl border border-hairline bg-panel overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead className="text-[10px] mono uppercase tracking-[0.18em] text-muted-foreground bg-panel/60">
              <tr>
                <th className="text-left px-4 py-2.5 w-[180px]"><Stethoscope className="size-3.5 inline mr-1.5" />Role</th>
                <th className="text-left">Email</th>
                <th className="text-left">Password</th>
                <th className="text-left">Lands on</th>
                <th className="w-[120px]"></th>
              </tr>
            </thead>
            <tbody>
              {state?.accounts.map((a) => (
                <tr key={a.email} className="border-t border-hairline/60 hover:bg-panel/40">
                  <td className="px-4 py-2 font-semibold">{a.role_label}</td>
                  <td className="mono">
                    <button onClick={() => copy(a.email, "Email")} className="inline-flex items-center gap-1.5 hover:text-action">
                      {a.email}<Copy className="size-3 opacity-60" />
                    </button>
                  </td>
                  <td className="mono">
                    {a.password ? (
                      <button onClick={() => copy(a.password!, "Password")} className="inline-flex items-center gap-1.5 hover:text-action">
                        {showAll ? a.password : "••••••••••••"}
                        <Copy className="size-3 opacity-60" />
                      </button>
                    ) : (
                      <span className="text-muted-foreground">hidden</span>
                    )}
                  </td>
                  <td className="mono text-muted-foreground">{a.lands_on}</td>
                  <td className="pr-3">
                    <Link
                      to="/demo-login"
                      search={{ role: roleKey(a), autosignin: a.password ? "1" : undefined } as never}
                      className="px-2.5 h-7 rounded bg-action text-action-foreground mono text-[10px] uppercase tracking-widest inline-flex items-center gap-1"
                    >
                      <LogIn className="size-3" />Sign in
                    </Link>
                  </td>
                </tr>
              ))}
              {!state && (
                <tr><td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>Loading sandbox accounts…</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <div className="text-center text-[12px] text-muted-foreground space-x-3">
          <Link to="/demo-login" className="text-action underline">Minimal sign-in form</Link>
          <span>·</span>
          <Link to="/" className="hover:text-foreground">Back to site</Link>
        </div>
      </main>
    </div>
  );
}