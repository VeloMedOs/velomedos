import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Activity, Heart, Wind, Stethoscope, Navigation, Clock, MapPin, Zap } from "lucide-react";

/**
 * VeloMed OS Command Hero — Network → Region → Team
 * Auto-demos on load; visitor can click any level.
 * No real map dependency; uses a styled satellite-ground SVG so the page
 * renders without a Google Maps key. The /platform route wires the real map.
 */

type Level = "network" | "region" | "team";

type Branch = { id: string; name: string; x: number; y: number; cases: number; teams: number };

const BRANCHES: Branch[] = [
  { id: "eastern",  name: "Eastern",  x: 78, y: 40, cases: 24, teams: 31 },
  { id: "central",  name: "Central",  x: 52, y: 48, cases: 41, teams: 58 },
  { id: "northern", name: "Northern", x: 48, y: 18, cases: 9,  teams: 14 },
  { id: "western",  name: "Western",  x: 20, y: 52, cases: 17, teams: 22 },
  { id: "southern", name: "Southern", x: 44, y: 82, cases: 12, teams: 19 },
];

type Case = { id: string; district: string; x: number; y: number; severity: "critical" | "transfer" | "routine" };
const EASTERN_DISTRICTS = [
  { name: "Jubail",    x: 30, y: 18 },
  { name: "Dammam",    x: 48, y: 36 },
  { name: "Qatif",     x: 38, y: 30 },
  { name: "Al Khobar", x: 56, y: 52 },
  { name: "Dhahran",   x: 50, y: 60 },
  { name: "Al Ahsa",   x: 78, y: 78 },
];
const EASTERN_CASES: Case[] = [
  { id: "C-2041", district: "Al Khobar", x: 58, y: 50, severity: "critical" },
  { id: "C-2039", district: "Dammam",    x: 46, y: 38, severity: "transfer" },
  { id: "C-2037", district: "Dhahran",   x: 52, y: 62, severity: "routine" },
  { id: "C-2034", district: "Qatif",     x: 36, y: 30, severity: "routine" },
  { id: "C-2030", district: "Jubail",    x: 32, y: 16, severity: "transfer" },
  { id: "C-2028", district: "Al Ahsa",   x: 76, y: 78, severity: "critical" },
];

const SEV_COLOR: Record<Case["severity"], string> = {
  critical: "var(--color-coral)",
  transfer: "var(--color-caution)",
  routine:  "var(--color-sky)",
};

export function CommandHero() {
  const [level, setLevel] = useState<Level>("network");
  const [branchId, setBranchId] = useState<string>("eastern");
  const interacted = useRef(false);

  // Auto-demo: network → region → team, once, unless user clicks.
  useEffect(() => {
    const t1 = setTimeout(() => { if (!interacted.current) setLevel("region"); }, 2400);
    const t2 = setTimeout(() => { if (!interacted.current) setLevel("team"); },   4800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  function go(l: Level) { interacted.current = true; setLevel(l); }
  const branch = BRANCHES.find((b) => b.id === branchId)!;

  return (
    <section className="relative overflow-hidden border-b border-hairline">
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(var(--color-hairline) 1px, transparent 1px), linear-gradient(90deg, var(--color-hairline) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative max-w-[1400px] mx-auto px-4 lg:px-8 pt-16 pb-16 grid lg:grid-cols-12 gap-8 lg:gap-10">
        {/* Left: copy + CTAs */}
        <div className="lg:col-span-5 space-y-6">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-panel border border-hairline mono text-[10px] uppercase tracking-[0.2em] text-teal">
            <span className="size-1.5 rounded-full bg-teal animate-pulse" /> Branch-aware · live across your network
          </div>
          <h1 className="font-serif text-5xl lg:text-[68px] leading-[0.98] tracking-tight">
            From your whole network<br/>
            <span className="italic text-teal">down to one crew.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl">
            Drill from the network, into a region's live cases, down to a single team and the patient in its care. One operating system, one map, one source of truth.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/demo" className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-teal text-background mono text-xs uppercase tracking-widest font-bold hover:bg-teal/90 shadow-[0_0_28px_oklch(0.74_0.13_195/0.35)]">
              Book a demo <ArrowRight className="size-3.5" />
            </Link>
            <Link to="/platform" className="inline-flex items-center gap-2 px-5 py-3 rounded-md border border-hairline mono text-xs uppercase tracking-widest hover:bg-panel">
              See the platform <ArrowRight className="size-3.5" />
            </Link>
          </div>

          {/* Three lenses summary (always present, populated when team locked) */}
          {level === "team" && (
            <div className="grid grid-cols-3 gap-3 pt-4">
              <Lens icon={<Navigation className="size-3.5" />} label="Movement" value="68 km/h" hint="ETA 4:12" />
              <Lens icon={<Heart className="size-3.5" />}      label="Patient"  value="P1 Critical" hint="HR 132 · SpO2 91%" />
              <Lens icon={<Stethoscope className="size-3.5" />} label="Next"     value="C-2039" hint="ETR ~14 min" />
            </div>
          )}
        </div>

        {/* Right: interactive command frame */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-hairline bg-panel overflow-hidden shadow-[0_0_120px_-40px_oklch(0.74_0.13_195/0.35)]">
            {/* switch + breadcrumb */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-hairline bg-background/40">
              <div className="inline-flex rounded-md border border-hairline overflow-hidden mono text-[10px] uppercase tracking-widest">
                {(["network","region","team"] as Level[]).map((l) => (
                  <button key={l} onClick={() => go(l)}
                    className={`px-3 py-1.5 transition-colors ${level===l ? "bg-teal text-background font-bold" : "text-muted-foreground hover:bg-panel-elevated"}`}>{l}</button>
                ))}
              </div>
              <Breadcrumb level={level} branch={branch.name} onJump={go} />
            </div>

            <div className="relative aspect-[16/10] bg-[oklch(0.22_0.02_240)]">
              {level === "network" && <NetworkView onPick={(b) => { setBranchId(b); go("region"); }} />}
              {level === "region"  && <RegionView branch={branch} onPickTeam={() => go("team")} />}
              {level === "team"    && <TeamView />}

              {/* corner badge */}
              <div className="absolute top-3 right-3 mono text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-background/70 border border-hairline text-muted-foreground">
                Live · 5 Hz GPS
              </div>
            </div>

            {level === "team" && <TeamLensRow />}
          </div>
        </div>
      </div>
    </section>
  );
}

function Breadcrumb({ level, branch, onJump }: { level: Level; branch: string; onJump: (l: Level) => void }) {
  return (
    <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
      <button onClick={() => onJump("network")} className={`hover:text-foreground ${level==="network"?"text-foreground":""}`}>Network</button>
      {level !== "network" && (<>
        <ChevronRight className="size-3" />
        <button onClick={() => onJump("region")} className={`hover:text-foreground ${level==="region"?"text-foreground":""}`}>{branch} Region</button>
      </>)}
      {level === "team" && (<>
        <ChevronRight className="size-3" />
        <span className="text-foreground">Crew 04</span>
      </>)}
    </div>
  );
}

function Lens({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-panel p-3">
      <div className="flex items-center gap-1.5 text-teal mono text-[9px] uppercase tracking-widest">{icon}{label}</div>
      <div className="text-sm font-semibold mt-1.5">{value}</div>
      <div className="mono text-[10px] text-muted-foreground mt-0.5">{hint}</div>
    </div>
  );
}

/* ----------------- NETWORK ----------------- */
function NetworkView({ onPick }: { onPick: (id: string) => void }) {
  return (
    <svg viewBox="0 0 100 62" className="absolute inset-0 w-full h-full">
      {/* faint kingdom outline */}
      <defs>
        <radialGradient id="gNet" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="oklch(0.30 0.04 220)" />
          <stop offset="100%" stopColor="oklch(0.18 0.02 240)" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="100" height="62" fill="url(#gNet)" />
      <path d="M8,32 Q18,12 38,10 Q60,8 70,14 Q86,20 90,34 Q92,46 78,54 Q60,60 42,58 Q22,56 12,46 Z"
        fill="oklch(0.24 0.03 220)" stroke="oklch(0.34 0.04 210)" strokeWidth="0.3" />

      {/* connecting lines */}
      {BRANCHES.map((b, i) => BRANCHES.slice(i+1).map((c) => (
        <line key={b.id+c.id} x1={b.x} y1={b.y} x2={c.x} y2={c.y} stroke="oklch(0.74 0.13 195 / 0.18)" strokeWidth="0.18" strokeDasharray="0.6 0.6" />
      )))}

      {BRANCHES.map((b) => (
        <g key={b.id} className="cursor-pointer" onClick={() => onPick(b.id)}>
          <circle cx={b.x} cy={b.y} r="3.6" fill="oklch(0.74 0.13 195 / 0.18)" />
          <circle cx={b.x} cy={b.y} r="1.6" fill="var(--color-teal)" />
          <text x={b.x} y={b.y - 4.4} textAnchor="middle" fill="var(--color-foreground)" fontSize="2.4" fontFamily="Inter" fontWeight="600">{b.name}</text>
          <text x={b.x} y={b.y + 6.2} textAnchor="middle" fill="var(--color-muted-foreground)" fontSize="1.8" fontFamily="JetBrains Mono">{b.cases} cases · {b.teams} teams</text>
        </g>
      ))}
    </svg>
  );
}

/* ----------------- REGION ----------------- */
function RegionView({ branch, onPickTeam }: { branch: Branch; onPickTeam: () => void }) {
  return (
    <div className="absolute inset-0">
      <svg viewBox="0 0 100 62" className="absolute inset-0 w-full h-full">
        <defs>
          <pattern id="sat" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="oklch(0.24 0.025 145)" />
            <circle cx="2" cy="3" r="0.4" fill="oklch(0.30 0.03 140)" />
            <circle cx="4.5" cy="1.5" r="0.3" fill="oklch(0.32 0.03 150)" />
          </pattern>
        </defs>
        <rect width="100" height="62" fill="url(#sat)" />
        {/* coastline */}
        <path d="M0,0 L66,0 Q70,18 60,30 Q52,42 60,54 Q66,62 100,62 L100,0 Z" fill="oklch(0.22 0.04 230)" opacity="0.7" />
        {/* district overlays */}
        {EASTERN_DISTRICTS.map((d) => (
          <g key={d.name}>
            <circle cx={d.x} cy={d.y} r="6" fill="oklch(0.74 0.13 195 / 0.07)" stroke="oklch(0.74 0.13 195 / 0.35)" strokeWidth="0.15" strokeDasharray="0.5 0.5" />
            <text x={d.x} y={d.y + 0.8} textAnchor="middle" fill="oklch(0.85 0.01 240)" fontSize="1.8" fontFamily="JetBrains Mono">{d.name}</text>
          </g>
        ))}
        {/* cases */}
        {EASTERN_CASES.map((c) => (
          <g key={c.id} className="cursor-pointer" onClick={onPickTeam}>
            <circle cx={c.x} cy={c.y} r="2.4" fill={SEV_COLOR[c.severity]} opacity="0.25" />
            <circle cx={c.x} cy={c.y} r="1.1" fill={SEV_COLOR[c.severity]}>
              <animate attributeName="r" values="1.1;1.6;1.1" dur="1.8s" repeatCount="indefinite" />
            </circle>
          </g>
        ))}
      </svg>

      {/* legend */}
      <div className="absolute bottom-3 left-3 rounded-md bg-background/70 border border-hairline p-2 mono text-[10px] uppercase tracking-widest space-y-1">
        <div className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: SEV_COLOR.critical }} /> Critical</div>
        <div className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: SEV_COLOR.transfer }} /> Transfer</div>
        <div className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: SEV_COLOR.routine }} /> Routine</div>
      </div>
      <div className="absolute top-3 left-3 rounded-md bg-background/70 border border-hairline px-2 py-1 mono text-[10px] uppercase tracking-widest">
        {branch.name} Region · {EASTERN_CASES.length} live cases · {branch.teams} teams
      </div>
      <div className="absolute bottom-3 right-3 rounded-md bg-background/70 border border-hairline overflow-hidden mono text-xs">
        <button className="px-2 py-1 hover:bg-panel-elevated">+</button>
        <span className="px-2 py-1 border-l border-hairline">−</span>
      </div>
    </div>
  );
}

/* ----------------- TEAM ----------------- */
function TeamView() {
  // Path A→B along Al Thuqbah → Al Mana General Hospital
  const path = "M14,52 C26,46 34,40 44,36 C56,32 64,28 78,24";
  const [progress, setProgress] = useState(0.18);
  useEffect(() => {
    let raf = 0; let last = performance.now();
    function tick(t: number) {
      const dt = (t - last) / 1000; last = t;
      setProgress((p) => (p + dt * 0.04) % 1);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pos = useMemo(() => sampleCubicBezier(progress), [progress]);

  return (
    <div className="absolute inset-0">
      <svg viewBox="0 0 100 62" className="absolute inset-0 w-full h-full">
        <defs>
          <pattern id="sat2" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="oklch(0.23 0.025 150)" />
            <circle cx="2" cy="3" r="0.4" fill="oklch(0.30 0.03 145)" />
          </pattern>
        </defs>
        <rect width="100" height="62" fill="url(#sat2)" />
        <path d="M0,0 L66,0 Q70,18 60,30 Q52,42 60,54 Q66,62 100,62 L100,0 Z" fill="oklch(0.22 0.04 230)" opacity="0.7" />

        {/* alternative faint routes */}
        <path d="M14,52 C30,52 50,46 78,24" stroke="oklch(0.74 0.13 195 / 0.25)" strokeWidth="0.45" fill="none" strokeDasharray="0.8 0.8" />
        <path d="M14,52 C20,40 42,30 78,24" stroke="oklch(0.74 0.13 195 / 0.25)" strokeWidth="0.45" fill="none" strokeDasharray="0.8 0.8" />

        {/* full route (light remaining) */}
        <path d={path} stroke="oklch(0.74 0.13 195 / 0.45)" strokeWidth="0.9" fill="none" strokeLinecap="round" />
        {/* travelled part filling behind vehicle */}
        <path d={path} stroke="var(--color-teal)" strokeWidth="0.9" fill="none" strokeLinecap="round"
              pathLength={1} strokeDasharray={`${progress} ${1 - progress}`} />

        {/* origin A */}
        <circle cx={14} cy={52} r="1.6" fill="var(--color-sky)" />
        <text x={14} y={50} textAnchor="middle" fill="var(--color-foreground)" fontSize="1.8" fontFamily="JetBrains Mono">A · Al Thuqbah</text>

        {/* destination B */}
        <g>
          <circle cx={78} cy={24} r="2.4" fill="var(--color-coral)" opacity="0.25">
            <animate attributeName="r" values="2.4;3.4;2.4" dur="1.6s" repeatCount="indefinite" />
          </circle>
          <circle cx={78} cy={24} r="1.4" fill="var(--color-coral)" />
          <text x={78} y={20} textAnchor="middle" fill="var(--color-foreground)" fontSize="1.8" fontFamily="Inter" fontWeight="600">B · Al Mana General</text>
        </g>

        {/* moving vehicle */}
        <g transform={`translate(${pos.x} ${pos.y})`}>
          <circle r="2.6" fill="var(--color-teal)" opacity="0.25" />
          <circle r="1.3" fill="var(--color-teal)" />
        </g>
      </svg>

      {/* ETA bubble pinned to B */}
      <div className="absolute" style={{ left: "78%", top: "10%" }}>
        <div className="rounded-md bg-background/80 border border-coral/40 px-2 py-1 mono text-[10px] uppercase tracking-widest text-coral flex items-center gap-1">
          <Clock className="size-3" /> ETA 4:12
        </div>
      </div>

      <div className="absolute top-3 left-3 rounded-md bg-background/70 border border-hairline px-2 py-1 mono text-[10px] uppercase tracking-widest flex items-center gap-2">
        <MapPin className="size-3 text-teal" /> Crew 04 · ALS · 2 onboard
      </div>
    </div>
  );
}

function TeamLensRow() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 border-t border-hairline">
      <LensPanel
        title="Movement"
        icon={<Navigation className="size-3.5" />}
        rows={[
          ["Speed", "68 km/h"],
          ["ETA",   "4:12"],
          ["Distance left", "3.2 km"],
          ["Trip time", "00:11:42"],
          ["A → B progress", "62%"],
        ]}
      />
      <LensPanel
        title="Patient onboard"
        icon={<Heart className="size-3.5" />}
        accent="coral"
        rows={[
          ["Acuity", "P1 Critical"],
          ["HR", "132 bpm"],
          ["BP", "92 / 58"],
          ["SpO₂", "91%"],
          ["GCS", "11"],
        ]}
        note="Suspected internal bleeding · pre-alert sent to trauma bay"
      />
      <LensPanel
        title="Next request"
        icon={<Zap className="size-3.5" />}
        rows={[
          ["Case", "C-2039 · Transfer"],
          ["Pickup", "Dammam Medical Tower"],
          ["Destination", "King Fahd Specialist"],
          ["Time to respond", "~14 min"],
          ["After handoff", "Auto-queue"],
        ]}
      />
    </div>
  );
}

function LensPanel({ title, icon, rows, note, accent = "teal" }: { title: string; icon: React.ReactNode; rows: [string, string][]; note?: string; accent?: "teal" | "coral" }) {
  const accentClass = accent === "coral" ? "text-coral" : "text-teal";
  return (
    <div className="p-4 border-r border-hairline last:border-r-0">
      <div className={`mono text-[10px] uppercase tracking-widest ${accentClass} flex items-center gap-1.5`}>{icon}{title}</div>
      <dl className="mt-3 space-y-1.5">
        {rows.map(([k,v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</dt>
            <dd className="mono text-sm font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-3 text-xs text-muted-foreground italic border-l-2 border-hairline pl-2">{note}</p>}
    </div>
  );
}

// Sample a cubic bezier approximation of "M14,52 C26,46 34,40 44,36 C56,32 64,28 78,24"
function sampleCubicBezier(t: number) {
  // two cubic segments
  const seg = t < 0.5 ? 0 : 1;
  const localT = (t - seg * 0.5) * 2;
  const segs = [
    [[14,52],[26,46],[34,40],[44,36]],
    [[44,36],[56,32],[64,28],[78,24]],
  ];
  const [p0,p1,p2,p3] = segs[seg];
  const u = 1 - localT;
  const x = u*u*u*p0[0] + 3*u*u*localT*p1[0] + 3*u*localT*localT*p2[0] + localT*localT*localT*p3[0];
  const y = u*u*u*p0[1] + 3*u*u*localT*p1[1] + 3*u*localT*localT*p2[1] + localT*localT*localT*p3[1];
  return { x, y };
}