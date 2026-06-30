import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, type ThemePref } from "@/lib/theme";

const OPTIONS: Array<{ id: ThemePref; label: string; icon: typeof Sun }> = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark",  label: "Dark",  icon: Moon },
  { id: "auto",  label: "Auto",  icon: Monitor },
];

/**
 * Compact 3-segment theme toggle. Use anywhere — it self-styles against the
 * resolved theme via semantic tokens, so no per-surface overrides are needed.
 */
export function ThemeSwitcher({ size = "sm", className = "" }: { size?: "sm" | "xs"; className?: string }) {
  const { theme, setTheme } = useTheme();
  const sz = size === "xs" ? "size-3" : "size-3.5";
  const pad = size === "xs" ? "px-1.5 py-1" : "px-2 py-1.5";
  return (
    <div
      role="group"
      aria-label="Theme"
      className={`inline-flex items-center rounded-md border border-hairline bg-panel/60 backdrop-blur p-0.5 ${className}`}
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-label={opt.label}
            aria-pressed={active}
            onClick={() => setTheme(opt.id)}
            title={opt.label}
            className={`inline-flex items-center justify-center rounded ${pad} transition-colors ${
              active
                ? "bg-teal/15 text-teal"
                : "text-muted-foreground hover:text-foreground hover:bg-panel-elevated"
            }`}
          >
            <Icon className={sz} />
          </button>
        );
      })}
    </div>
  );
}
