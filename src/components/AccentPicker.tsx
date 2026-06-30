import { useEffect, useRef, useState } from "react";
import { Palette, Check } from "lucide-react";
import { ACCENTS, useTheme, type AccentId } from "@/lib/theme";

/**
 * Brand-accent picker. Renders as a single swatch button that opens a small
 * popover of color choices. Selection is persisted via ThemeProvider
 * (localStorage + profiles.accent_preference) and instantly remaps the
 * brand teal token project-wide.
 */
export function AccentPicker({ className = "" }: { className?: string }) {
  const { accent, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const active = ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={`Accent color: ${active.label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`Accent · ${active.label}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-panel/60 backdrop-blur px-2 py-1.5 text-muted-foreground hover:text-foreground hover:bg-panel-elevated transition-colors"
      >
        <Palette className="size-3.5" />
        <span
          aria-hidden
          className="size-3 rounded-full ring-1 ring-hairline shadow-sm"
          style={{ background: active.swatch }}
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose brand accent"
          className="absolute right-0 top-full mt-2 z-50 w-[200px] rounded-lg border border-hairline bg-popover text-popover-foreground shadow-lg p-3"
        >
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2 flex items-center gap-1.5">
            <Palette className="size-3" /> Brand accent
          </div>
          <div className="grid grid-cols-4 gap-2">
            {ACCENTS.map((opt) => {
              const selected = opt.id === accent;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { setAccent(opt.id as AccentId); setOpen(false); }}
                  aria-pressed={selected}
                  aria-label={opt.label}
                  title={opt.label}
                  className={`relative size-9 rounded-full ring-1 transition-transform hover:scale-110 ${
                    selected ? "ring-2 ring-foreground" : "ring-hairline"
                  }`}
                  style={{ background: opt.swatch }}
                >
                  {selected && (
                    <Check
                      className="size-4 absolute inset-0 m-auto text-white drop-shadow"
                      strokeWidth={3}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground leading-snug">
            Applies to buttons, badges, focus rings, and marketing glow across the platform.
          </div>
        </div>
      )}
    </div>
  );
}
