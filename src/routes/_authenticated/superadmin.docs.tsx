import { createFileRoute, Link } from "@tanstack/react-router";
import { DocsPane } from "@/components/superadmin/DocsPane";

export const Route = createFileRoute("/_authenticated/superadmin/docs")({
  head: () => ({ meta: [{ title: "Documentation · Superadmin · VeloMed OS" }] }),
  component: SuperadminDocsPage,
});

function SuperadminDocsPage() {
  return (
    <main className="max-w-[1600px] mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Superadmin → Documentation</div>
        <Link to="/superadmin" className="mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border border-hairline hover:bg-panel-elevated">← Superadmin</Link>
      </div>
      <DocsPane />
    </main>
  );
}