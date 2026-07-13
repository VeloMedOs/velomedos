import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, LogIn, PlayCircle } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { readDemoVideosEnabled } from "@/lib/platform-settings.functions";

const title = "Try the VeloMed sandbox — VeloMed OS";
const desc = "Preview VeloMed OS with the physician demo account, or watch a guided walk-through of the full platform.";

export const Route = createFileRoute("/demo-tour")({
  head: () => ({
    meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
      { property: "og:url", content: "/demo-tour" }, { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" }, { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/demo-tour" }],
  }),
  component: DemoTour,
});

function DemoTour() {
  // Server fn returns { enabled }. The public endpoint uses `readDemoVideosEnabled`
  // over the jsonb `{ enabled }` wrapper (Batch2-W2).
  const [videosEnabled, setVideosEnabled] = useState(false);
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/public/v1/demo/tour-config");
        if (!res.ok) return;
        const j = await res.json() as { videos_enabled?: unknown };
        if (!cancel) setVideosEnabled(readDemoVideosEnabled(j.videos_enabled));
      } catch { /* leave disabled */ }
    })();
    return () => { cancel = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <section className="max-w-[1100px] mx-auto px-4 lg:px-8 pt-16 pb-24">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal mb-2">Try the sandbox</div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">Two ways to see VeloMed OS.</h1>
        <p className="text-muted-foreground mt-3 max-w-xl">Sandbox login uses read-only demo data with the physician role. No real PHI, no live NPHIES / ZATCA / D365 calls.</p>

        <div className="mt-10 grid md:grid-cols-2 gap-4">
          <Link
            to="/demo-login"
            data-testid="demo-tour-sandbox-card"
            className="group rounded-xl border border-hairline bg-panel p-6 hover:bg-panel-elevated transition-colors"
          >
            <LogIn className="size-6 text-teal mb-4" />
            <div className="text-lg font-semibold">Sandbox login</div>
            <p className="text-sm text-muted-foreground mt-2">Physician demo account · pre-loaded clinical data · lands on the clinical console.</p>
            <div className="mt-6 mono text-[10px] uppercase tracking-widest text-teal inline-flex items-center gap-1.5">
              Open sandbox <ArrowRight className="size-3" />
            </div>
          </Link>

          <div
            data-testid="demo-tour-video-card"
            data-enabled={videosEnabled ? "true" : "false"}
            className={`rounded-xl border border-hairline bg-panel p-6 ${videosEnabled ? "" : "opacity-70"}`}
          >
            <PlayCircle className="size-6 text-teal mb-4" />
            <div className="text-lg font-semibold">Guided video walk-through</div>
            {videosEnabled ? (
              <>
                <p className="text-sm text-muted-foreground mt-2">A 20-minute narrated tour of dispatch, clinical and revenue surfaces.</p>
                <a
                  href="/demo-tour/videos"
                  className="mt-6 inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-widest text-teal"
                >
                  Start tour <ArrowRight className="size-3" />
                </a>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mt-2">Coming soon — a narrated walk-through of every module.</p>
                <div className="mt-6 mono text-[10px] uppercase tracking-widest text-muted-foreground">Not yet available</div>
              </>
            )}
          </div>
        </div>

        <div className="mt-10 rounded-xl border border-hairline bg-panel/40 p-5 text-sm">
          <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Ready for a scoped walk-through?</div>
          <p className="text-muted-foreground">Request a live demo tailored to your fleet and cities.</p>
          <Link
            to="/"
            search={{ intake: "1" }}
            className="mt-3 inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-widest text-teal"
          >
            Book a real demo <ArrowRight className="size-3" />
          </Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}