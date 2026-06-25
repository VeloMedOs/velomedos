import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/api-docs")({
  head: () => ({
    links: [{ rel: "stylesheet", href: "https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" }],
  }),
  component: ApiDocs,
});

function ApiDocs() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod: any = await import(/* @vite-ignore */ "https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-es-bundle.js");
      if (cancelled || !ref.current) return;
      const SwaggerUIBundle = mod.default ?? mod.SwaggerUIBundle ?? (window as any).SwaggerUIBundle;
      SwaggerUIBundle({
        url: "/api/public/v1/openapi",
        domNode: ref.current,
        deepLinking: true,
        persistAuthorization: true,
      });
    })();
    return () => { cancelled = true; };
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