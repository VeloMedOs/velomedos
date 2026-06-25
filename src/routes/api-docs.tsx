import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

const SWAGGER_VERSION = "5.17.14";

export const Route = createFileRoute("/api-docs")({
  head: () => ({
    links: [{ rel: "stylesheet", href: `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui.css` }],
  }),
  component: ApiDocs,
});

function ApiDocs() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const existing = document.getElementById("swagger-ui-bundle") as HTMLScriptElement | null;
    function mount() {
      const SwaggerUIBundle = (window as unknown as { SwaggerUIBundle?: (opts: Record<string, unknown>) => void }).SwaggerUIBundle;
      if (!SwaggerUIBundle || !ref.current) return;
      SwaggerUIBundle({
        url: "/api/public/v1/openapi",
        domNode: ref.current,
        deepLinking: true,
        persistAuthorization: true,
      });
    }
    if (existing) {
      mount();
    } else {
      const s = document.createElement("script");
      s.id = "swagger-ui-bundle";
      s.src = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-bundle.js`;
      s.crossOrigin = "anonymous";
      s.onload = mount;
      document.head.appendChild(s);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-hairline bg-panel px-4 lg:px-8 py-4 flex items-center justify-between">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-action">VeloMed OS · Public API</div>
          <h1 className="text-2xl font-bold tracking-tight">REST v1 reference</h1>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/public/v1/openapi" target="_blank" rel="noreferrer" className="mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-hairline hover:bg-panel-elevated">openapi.json ↗</a>
          <Link to="/developer" className="mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded bg-action text-action-foreground font-bold">Get an API key</Link>
        </div>
      </div>
      <div className="swagger-shell bg-white text-black">
        <div ref={ref} />
      </div>
    </div>
  );
}