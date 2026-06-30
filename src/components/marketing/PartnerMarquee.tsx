import { useEffect, useState } from "react";

type Partner = { name: string; city?: string | null; type?: string | null; logo_url?: string | null };

export function PartnerMarquee() {
  const [items, setItems] = useState<Partner[]>([]);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancel = false;
    fetch("/api/public/v1/partners")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancel || !d) return;
        setItems(d.items ?? []);
        setCount(d.count ?? 0);
      })
      .catch(() => {});
    return () => { cancel = true; };
  }, []);

  // duplicate the list so the marquee loops seamlessly
  const ticker = items.length ? [...items, ...items] : [];

  return (
    <section aria-label="VeloMed OS partner networks" className="border-y border-hairline bg-panel/30">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6 flex flex-col gap-3">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-2">
          <span className="vital-dot" />
          Care networks onboarding with VeloMed OS
          {count !== null && <span className="text-teal">· {count}+ organizations</span>}
        </div>
        <div className="relative overflow-hidden marquee-fade">
          {ticker.length === 0 ? (
            <div className="text-xs text-muted-foreground py-3">Subscriber roster will appear here as partners opt in.</div>
          ) : (
            <div className="marquee-track flex gap-3 py-2 motion-reduce:flex-wrap motion-reduce:animate-none">
              {ticker.map((p, i) => (
                <div key={`${p.name}-${i}`} className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-hairline bg-background/40 mono text-[11px] uppercase tracking-widest">
                  {p.logo_url ? (
                    <img src={p.logo_url} alt="" className="size-4 rounded-sm object-contain" loading="lazy" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-teal" aria-hidden />
                  )}
                  <span className="text-foreground/85">{p.name}</span>
                  {p.city && <span className="text-muted-foreground">· {p.city}</span>}
                  {p.type && <span className="text-teal/80">· {p.type}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`
        .marquee-fade { -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
        .marquee-track { width: max-content; animation: marquee 42s linear infinite; }
        .marquee-fade:hover .marquee-track { animation-play-state: paused; }
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) { .marquee-track { animation: none; width: auto; flex-wrap: wrap; } }
      `}</style>
    </section>
  );
}