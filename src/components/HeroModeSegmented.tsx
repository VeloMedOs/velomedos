import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Activity, HeartPulse } from "lucide-react";
import { useHeroMode, type HeroMode } from "@/lib/hero-mode";

const OPTIONS: Array<{ id: HeroMode; label: string; short: string; icon: typeof Activity }> = [
  { id: "operations", label: "Operations",     short: "OPS",  icon: Activity },
  { id: "care",       label: "Care & Revenue", short: "C&R",  icon: HeartPulse },
];

/**
 * Segmented header control that drives the homepage hero lens.
 * - On `/`        → updates shared state in place.
 * - Elsewhere     → navigates to `/?mode=…` so the home opens in the chosen lens.
 */
export function HeroModeSegmented({ className = "" }: { className?: string }) {
  const { mode, setMode } = useHeroMode();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const onPick = (next: HeroMode) => {
    setMode(next);
    if (path !== "/") {
      navigate({ to: "/", search: { mode: next } as any });
    } else {
      // Update URL without a full nav so deep links stay shareable.
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("mode", next);
        window.history.replaceState({}, "", url.toString());
      } catch {}
    }
  };

  return (
    <div
      role="group"
      aria-label="Hero lens"
      className={`relative inline-flex items-center rounded-full border border-hairline bg-panel/60 backdrop-blur p-0.5 mono text-[10px] uppercase tracking-[0.18em] ${className}`}
    >
      {OPTIONS.map((opt) => {
        const active = mode === opt.id;
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(opt.id)}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-300 ${
              active
                ? "text-background shadow-[0_0_0_1px_oklch(0.78_0.13_185/0.35)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={active ? { background: "var(--gradient-brand)" } : undefined}
          >
            <Icon className="size-3" />
            <span className="hidden sm:inline">{opt.label}</span>
            <span className="sm:hidden">{opt.short}</span>
            {active && (
              <span
                aria-hidden
                className="absolute -right-1 -top-1 size-1.5 rounded-full bg-coral animate-pulse"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}