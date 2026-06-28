import { useEffect, useRef, useState } from "react";
import { isDebugOn, setDebugOn, subscribeDebug, reportDebugEvent } from "@/lib/debug-overlay";

type Box = {
  id: string;
  rect: DOMRect;
  z: string;
  anchorX: number;
  anchorY: number;
};

/**
 * Floating, dev-only debug overlay. Outlines every element tagged with
 * `data-debug-id`, prints its computed z-index and anchor point, and
 * reports detected stacking glitches (overlapping ETA bubble and
 * destination marker, ETA bubble overflowing viewport) to the
 * `debug_events` table so superadmins see them per-tenant.
 */
export function DebugOverlay() {
  const [on, setOn] = useState<boolean>(() => isDebugOn());
  const [boxes, setBoxes] = useState<Box[]>([]);
  const reported = useRef<Set<string>>(new Set());

  useEffect(() => subscribeDebug(setOn), []);

  useEffect(() => {
    if (!on) { setBoxes([]); return; }
    let raf = 0;
    const tick = () => {
      const nodes = document.querySelectorAll<HTMLElement>("[data-debug-id]");
      const next: Box[] = [];
      const glitches: string[] = [];
      nodes.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
        const cs = getComputedStyle(el);
        const id = el.dataset.debugId ?? "?";
        next.push({
          id, rect, z: cs.zIndex === "auto" ? "auto" : cs.zIndex,
          anchorX: rect.left + rect.width / 2,
          anchorY: rect.top + rect.height / 2,
        });
        if (rect.left < 0 || rect.top < 0 || rect.right > window.innerWidth || rect.bottom > window.innerHeight) {
          glitches.push(`${id}_overflow`);
        }
      });
      // pairwise overlap of ETA bubble vs destination marker (any pair)
      for (let i = 0; i < next.length; i++) {
        for (let j = i + 1; j < next.length; j++) {
          const a = next[i], b = next[j];
          const overlap = !(a.rect.right < b.rect.left || b.rect.right < a.rect.left ||
                            a.rect.bottom < b.rect.top || b.rect.bottom < a.rect.top);
          if (!overlap) continue;
          const tags = [a.id, b.id].sort().join("|");
          if (/eta/.test(a.id) && /dest|marker|pin/.test(b.id)) glitches.push(`overlap:${tags}`);
          if (/eta/.test(b.id) && /dest|marker|pin/.test(a.id)) glitches.push(`overlap:${tags}`);
        }
      }
      setBoxes(next);
      glitches.forEach((g) => {
        if (reported.current.has(g)) return;
        reported.current.add(g);
        reportDebugEvent({
          source: "overlay", kind: "glitch", severity: "warn",
          message: g,
          payload: { glitch: g, boxes: next.map((b) => ({ id: b.id, z: b.z, rect: serial(b.rect) })) },
        });
      });
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [on]);

  return (
    <>
      <button
        type="button"
        onClick={() => setDebugOn(!on)}
        title="Toggle debug overlay (z-index · anchors · bounding boxes)"
        className={`fixed bottom-3 left-3 z-[9999] mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1 rounded-md border ${on ? "bg-emergency text-emergency-foreground border-emergency" : "bg-panel/80 text-muted-foreground border-hairline hover:bg-panel"} backdrop-blur`}
      >
        {on ? "Debug ON" : "Debug"}
      </button>
      {on && (
        <div className="fixed inset-0 z-[9998] pointer-events-none" aria-hidden>
          {boxes.map((b) => (
            <div key={b.id}>
              <div
                className="absolute border-2 border-dashed"
                style={{
                  left: b.rect.left, top: b.rect.top,
                  width: b.rect.width, height: b.rect.height,
                  borderColor: hue(b.id),
                  boxShadow: `0 0 0 1px ${hue(b.id)}33`,
                }}
              />
              <div
                className="absolute mono text-[9px] px-1.5 py-0.5 rounded"
                style={{
                  left: b.rect.left, top: Math.max(0, b.rect.top - 16),
                  background: hue(b.id), color: "#000",
                }}
              >
                {b.id} · z={b.z} · {Math.round(b.rect.width)}×{Math.round(b.rect.height)}
              </div>
              <div
                className="absolute rounded-full"
                style={{
                  left: b.anchorX - 4, top: b.anchorY - 4,
                  width: 8, height: 8, background: hue(b.id),
                  boxShadow: `0 0 0 2px #000, 0 0 0 4px ${hue(b.id)}`,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function hue(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h} 90% 60%)`;
}
function serial(r: DOMRect) {
  return { x: r.x, y: r.y, w: r.width, h: r.height, top: r.top, left: r.left, right: r.right, bottom: r.bottom };
}