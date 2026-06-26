import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader, SiteFooter, EmergencyBanner } from "@/components/SiteChrome";
import { breadcrumbLd, jsonld } from "@/components/Jsonld";
import { Play, KeyRound, Lock, Unlock, Copy, Check, ExternalLink } from "lucide-react";

const title = "API reference & try-it console — VeloMed OS";
const desc = "Browse VeloMed OS REST endpoints with sample request and response. Run a live call from your browser against the public API.";

export const Route = createFileRoute("/api-reference")({
  head: () => ({
    meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:url", content: "/api-reference" }, { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" }, { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/api-reference" }],
    scripts: [
      { type: "application/ld+json", children: jsonld(breadcrumbLd([
        { name: "Home", href: "/" }, { name: "API reference", href: "/api-reference" },
      ])) },
    ],
  }),
  component: ApiReference,
});

type Endpoint = {
  id: string;
  method: "GET" | "POST";
  path: string;
  summary: string;
  scope?: string;
  open?: boolean;
  sampleBody?: string;
  curl: string;
};

const ENDPOINTS: Endpoint[] = [
  {
    id: "openapi",
    method: "GET",
    path: "/api/public/v1/openapi",
    summary: "Full OpenAPI 3.1 specification — no key required.",
    open: true,
    curl: `curl https://api.velomed.health/v1/openapi`,
  },
  {
    id: "web_intake",
    method: "POST",
    path: "/api/public/v1/web_intake",
    summary: "Public website intake — creates an incident or a lead. Rate-limited per IP.",
    open: true,
    sampleBody: JSON.stringify({
      kind: "general",
      name: "Try-it Tester",
      email: "tester@example.com",
      message: "Hello from the VeloMed API try-it console.",
    }, null, 2),
    curl: `curl -X POST https://api.velomed.health/v1/web_intake \\
  -H "content-type: application/json" \\
  -d '{"kind":"general","name":"Try-it","message":"hi"}'`,
  },
  {
    id: "fleet",
    method: "GET",
    path: "/api/public/v1/fleet",
    summary: "List ambulance fleet with live status.",
    scope: "fleet:read",
    curl: `curl https://api.velomed.health/v1/fleet \\
  -H "x-api-key: vmk_••••"`,
  },
  {
    id: "incidents-list",
    method: "GET",
    path: "/api/public/v1/incidents",
    summary: "List recent incidents.",
    scope: "incidents:read",
    curl: `curl https://api.velomed.health/v1/incidents \\
  -H "x-api-key: vmk_••••"`,
  },
  {
    id: "incidents-create",
    method: "POST",
    path: "/api/public/v1/incidents",
    summary: "File a new incident. Recorded in the audit log.",
    scope: "incidents:write",
    sampleBody: JSON.stringify({
      severity: "code_red",
      patient_name: "Anon",
      pickup_lat: 25.2048,
      pickup_lng: 55.2708,
      symptoms: "Chest pain",
    }, null, 2),
    curl: `curl -X POST https://api.velomed.health/v1/incidents \\
  -H "x-api-key: vmk_••••" \\
  -H "content-type: application/json" \\
  -d @incident.json`,
  },
  {
    id: "clinics",
    method: "GET",
    path: "/api/public/v1/clinics",
    summary: "Remote clinic directory (public-safe fields).",
    scope: "clinics:read",
    curl: `curl https://api.velomed.health/v1/clinics \\
  -H "x-api-key: vmk_••••"`,
  },
  {
    id: "courses",
    method: "GET",
    path: "/api/public/v1/courses",
    summary: "Training courses & certification programmes.",
    scope: "courses:read",
    curl: `curl https://api.velomed.health/v1/courses \\
  -H "x-api-key: vmk_••••"`,
  },
  {
    id: "credentials",
    method: "GET",
    path: "/api/public/v1/credentials?expiring_in_days=30",
    summary: "Credentials expiring within N days for compliance.",
    scope: "compliance:read",
    curl: `curl "https://api.velomed.health/v1/credentials?expiring_in_days=30" \\
  -H "x-api-key: vmk_••••"`,
  },
];

function ApiReference() {
  const [activeId, setActiveId] = useState(ENDPOINTS[0].id);
  const active = useMemo(() => ENDPOINTS.find((e) => e.id === activeId)!, [activeId]);
  const [apiKey, setApiKey] = useState("");
  const [body, setBody] = useState(active.sampleBody ?? "");
  const [status, setStatus] = useState<number | null>(null);
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // reset body when switching endpoints
  const onPick = (id: string) => {
    const ep = ENDPOINTS.find((e) => e.id === id)!;
    setActiveId(id);
    setBody(ep.sampleBody ?? "");
    setStatus(null);
    setResponse("");
  };

  const run = async () => {
    setLoading(true); setStatus(null); setResponse("");
    try {
      const headers: Record<string, string> = {};
      if (!active.open && apiKey) headers["x-api-key"] = apiKey;
      if (active.method === "POST") headers["content-type"] = "application/json";
      const res = await fetch(active.path, {
        method: active.method,
        headers,
        body: active.method === "POST" ? body : undefined,
      });
      setStatus(res.status);
      const text = await res.text();
      try { setResponse(JSON.stringify(JSON.parse(text), null, 2)); }
      catch { setResponse(text); }
    } catch (e) {
      setStatus(0);
      setResponse(`Request failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyCurl = async () => {
    await navigator.clipboard.writeText(active.curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <EmergencyBanner />
      <section className="max-w-[1200px] mx-auto px-4 lg:px-8 pt-14 pb-8">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-action mb-2">Developers · API reference</div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">Try the VeloMed OS API</h1>
        <p className="text-muted-foreground mt-4 max-w-2xl text-lg">
          Browse a curated set of REST endpoints, edit the request, run it live against this environment and read the JSON response. For full coverage see <Link to="/api-docs" className="text-action underline">Swagger UI</Link>.
        </p>
      </section>

      <section className="max-w-[1200px] mx-auto px-4 lg:px-8 pb-20 grid lg:grid-cols-[280px_minmax(0,1fr)] gap-6">
        <aside className="rounded-xl border border-hairline bg-panel overflow-hidden h-fit">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground px-4 py-3 border-b border-hairline">Endpoints</div>
          <ul className="divide-y divide-hairline">
            {ENDPOINTS.map((e) => {
              const isActive = e.id === activeId;
              return (
                <li key={e.id}>
                  <button onClick={() => onPick(e.id)} className={`w-full text-left px-4 py-3 hover:bg-panel-elevated ${isActive ? "bg-panel-elevated" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className={`mono text-[10px] font-bold px-1.5 py-0.5 rounded ${e.method === "GET" ? "bg-action/15 text-action" : "bg-emergency/15 text-emergency"}`}>{e.method}</span>
                      {e.open ? <Unlock className="size-3 text-stable" /> : <Lock className="size-3 text-muted-foreground" />}
                    </div>
                    <div className="mono text-[11px] mt-1.5 truncate">{e.path.replace("/api/public/v1","")}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="space-y-4 min-w-0">
          <div className="rounded-xl border border-hairline bg-panel p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className={`mono text-[10px] font-bold px-1.5 py-0.5 rounded ${active.method === "GET" ? "bg-action/15 text-action" : "bg-emergency/15 text-emergency"}`}>{active.method}</span>
              <code className="mono text-xs text-muted-foreground truncate">{active.path}</code>
              {active.open
                ? <span className="ml-auto mono text-[10px] uppercase tracking-widest text-stable flex items-center gap-1"><Unlock className="size-3" /> open</span>
                : <span className="ml-auto mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1"><Lock className="size-3" /> scope {active.scope}</span>}
            </div>
            <p className="text-sm text-muted-foreground">{active.summary}</p>
          </div>

          {!active.open && (
            <div className="rounded-xl border border-hairline bg-panel p-5">
              <label className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-2 mb-2"><KeyRound className="size-3" /> x-api-key</label>
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="vmk_..."
                className="w-full bg-background border border-hairline rounded-md px-3 py-2 mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground mt-2">Generate a scoped key in the <Link to="/developer" className="text-action underline">Developer console</Link>. The key stays in your browser.</p>
            </div>
          )}

          {active.method === "POST" && (
            <div className="rounded-xl border border-hairline bg-panel p-5">
              <label className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2 block">Request body · application/json</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                className="w-full bg-background border border-hairline rounded-md px-3 py-2 mono text-xs leading-relaxed"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={run}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-action text-action-foreground mono text-xs uppercase tracking-widest font-bold disabled:opacity-50"
            >
              <Play className="size-3.5" /> {loading ? "Running…" : "Send request"}
            </button>
            <button onClick={copyCurl} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-hairline mono text-xs uppercase tracking-widest hover:bg-panel">
              {copied ? <Check className="size-3.5 text-stable" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy curl"}
            </button>
            <Link to="/api-docs" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-hairline mono text-xs uppercase tracking-widest hover:bg-panel ml-auto">
              Full reference <ExternalLink className="size-3.5" />
            </Link>
          </div>

          <div className="rounded-xl border border-hairline bg-panel overflow-hidden">
            <div className="px-4 py-2 border-b border-hairline flex items-center justify-between mono text-[10px] uppercase tracking-widest">
              <span className="text-action">Response</span>
              {status !== null && (
                <span className={status >= 200 && status < 300 ? "text-stable" : "text-emergency"}>
                  HTTP {status || "ERR"}
                </span>
              )}
            </div>
            <pre className="text-[11px] leading-relaxed text-muted-foreground p-4 font-mono overflow-auto max-h-[420px] whitespace-pre-wrap">{response || "// Click 'Send request' to see the response from this environment."}</pre>
          </div>

          <div className="rounded-xl border border-hairline bg-panel overflow-hidden">
            <div className="px-4 py-2 border-b border-hairline mono text-[10px] uppercase tracking-widest text-action">Sample curl</div>
            <pre className="text-[11px] leading-relaxed text-muted-foreground p-4 font-mono overflow-auto whitespace-pre">{active.curl}</pre>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}