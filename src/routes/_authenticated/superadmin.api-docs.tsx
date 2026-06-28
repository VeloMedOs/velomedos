import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";

const SWAGGER_VERSION = "5.17.14";

export const Route = createFileRoute("/_authenticated/superadmin/api-docs")({
  head: () => ({
    meta: [{ title: "Admin API · VeloMed OS Superadmin" }],
    links: [{ rel: "stylesheet", href: `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui.css` }],
  }),
  component: AdminSwagger,
});

function AdminSwagger() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const existing = document.getElementById("swagger-ui-bundle-admin") as HTMLScriptElement | null;
    function mount() {
      const SwaggerUIBundle = (window as unknown as { SwaggerUIBundle?: (opts: Record<string, unknown>) => void }).SwaggerUIBundle;
      if (!SwaggerUIBundle || !ref.current) return;
      SwaggerUIBundle({
        url: "/api/admin/v1/openapi",
        domNode: ref.current,
        deepLinking: true,
        persistAuthorization: true,
      });
    }
    if (existing) { mount(); return; }
    const s = document.createElement("script");
    s.id = "swagger-ui-bundle-admin";
    s.src = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-bundle.js`;
    s.crossOrigin = "anonymous";
    s.onload = mount;
    document.head.appendChild(s);
  }, []);

  return (
    <div className="min-h-screen bg-[#080B11] text-white">
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/10 bg-[#0B0F18]">
        <div className="flex items-center gap-3">
          <Link to="/superadmin" className="text-xs uppercase tracking-widest text-white/50 hover:text-white inline-flex items-center gap-1.5"><ArrowLeft className="w-3.5 h-3.5"/>Back to portal</Link>
          <span className="text-white/20">·</span>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#28D6B6]">Control Plane</div>
            <h1 className="text-xl font-bold tracking-tight">Admin API · v1</h1>
          </div>
        </div>
        <a href="/api/admin/v1/openapi" target="_blank" rel="noreferrer" className="text-[10px] font-mono uppercase tracking-widest px-3 py-1.5 rounded border border-white/10 hover:bg-white/5">openapi.json &#8599;</a>
      </div>
      <div className="bg-white text-black"><div ref={ref} /></div>
    </div>
  );
}