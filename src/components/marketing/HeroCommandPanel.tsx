import { useState } from "react";
import { CommandHero } from "@/components/CommandHero";
import { CareRevenuePanel } from "@/components/marketing/CareRevenuePanel";

type Mode = "operations" | "care";

/**
 * Wraps the existing CommandHero unchanged under an OPERATIONS | CARE & REVENUE
 * toggle. CARE & REVENUE renders the new HIS/RCM lens.
 */
export function HeroCommandPanel() {
  const [mode, setMode] = useState<Mode>("operations");
  return (
    <div className="relative">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 pt-6 flex items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-hairline bg-panel/60 backdrop-blur mono text-[10px] uppercase tracking-widest p-0.5">
          <button
            onClick={() => setMode("operations")}
            className={`px-3 py-1.5 rounded-md transition-colors ${mode === "operations" ? "bg-teal/15 text-teal" : "text-muted-foreground hover:text-foreground"}`}
          >Operations</button>
          <button
            onClick={() => setMode("care")}
            className={`px-3 py-1.5 rounded-md transition-colors ${mode === "care" ? "bg-teal/15 text-teal" : "text-muted-foreground hover:text-foreground"}`}
          >Care &amp; Revenue</button>
        </div>
        <span className="inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-widest text-coral">
          <span className="size-1.5 rounded-full bg-coral animate-pulse" /> live
        </span>
      </div>

      {mode === "operations" ? (
        <CommandHero />
      ) : (
        <section className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6">
          <div className="grid lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-5 flex flex-col justify-center">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-teal">Clinical &amp; revenue · the same OS</div>
              <h1 className="font-serif text-4xl lg:text-6xl tracking-tight mt-3">
                Clean claims, <span className="italic text-teal">faster than the field.</span>
              </h1>
              <p className="text-muted-foreground mt-4 max-w-[44ch] leading-relaxed">
                Eligibility, authorization and AR-DRG coding live next to the dispatch board — so claims
                go out clean the first time and cash returns in days, not months.
              </p>
              <div className="mt-4 mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Built to NPHIES · CHI MDS · AR-DRG v9 · ZATCA · VAT 15% — integration-ready, sandboxed until credentials live.
              </div>
            </div>
            <div className="lg:col-span-7">
              <CareRevenuePanel />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}