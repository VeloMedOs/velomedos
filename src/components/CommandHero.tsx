/// <reference types="google.maps" />
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Heart, Stethoscope, Navigation, Clock, MapPin, Zap, Compass, Layers, Plus, Minus, Radio, Activity } from "lucide-react";

/**
 * VeloMed OS Command Hero — Network → Region → Team
 * Region + Team render on the REAL Google Maps satellite/hybrid base, mirroring
 * the Google Maps mobile layout (primary blue route + lighter alternates with
 * time bubbles + red destination teardrop). Network is a kingdom-wide overview.
 */

type Level = "network" | "region" | "team";

type Branch = { id: string; name: string; lat: number; lng: number; cases: number; teams: number };

const BRANCHES: Branch[] = [
  { id: "eastern",  name: "Eastern",  lat: 26.43, lng: 50.10, cases: 24, teams: 31 },
  { id: "central",  name: "Central",  lat: 24.71, lng: 46.68, cases: 41, teams: 58 },
  { id: "northern", name: "Northern", lat: 28.38, lng: 36.57, cases: 9,  teams: 14 },
  { id: "western",  name: "Western",  lat: 21.49, lng: 39.19, cases: 17, teams: 22 },
  { id: "southern", name: "Southern", lat: 18.21, lng: 42.50, cases: 12, teams: 19 },
];

type Case = { id: string; district: string; lat: number; lng: number; severity: "critical" | "transfer" | "routine" };
const EASTERN_DISTRICTS = [
  { name: "Jubail",    lat: 27.011, lng: 49.660 },
  { name: "Dammam",    lat: 26.434, lng: 50.103 },
  { name: "Qatif",     lat: 26.565, lng: 49.996 },
  { name: "Al Khobar", lat: 26.279, lng: 50.209 },
  { name: "Dhahran",   lat: 26.288, lng: 50.114 },
  { name: "Al Ahsa",   lat: 25.380, lng: 49.587 },
];
const EASTERN_CASES: Case[] = [
  { id: "C-2041", district: "Al Khobar", lat: 26.281, lng: 50.207, severity: "critical" },
  { id: "C-2039", district: "Dammam",    lat: 26.440, lng: 50.099, severity: "transfer" },
  { id: "C-2037", district: "Dhahran",   lat: 26.292, lng: 50.118, severity: "routine" },
  { id: "C-2034", district: "Qatif",     lat: 26.568, lng: 50.001, severity: "routine" },
  { id: "C-2030", district: "Jubail",    lat: 27.014, lng: 49.663, severity: "transfer" },
  { id: "C-2028", district: "Al Ahsa",   lat: 25.383, lng: 49.590, severity: "critical" },
];

// Team A→B: Al Thuqbah (Al Khobar) → Al Mana General Hospital (Al Khobar)
const TEAM_A = { lat: 26.2541, lng: 50.2024, label: "Al Thuqbah" };
const TEAM_B = { lat: 26.2986, lng: 50.1903, label: "Al Mana General" };

const SEV_COLOR: Record<Case["severity"], string> = {
  critical: "#ef4444",
  transfer: "#f59e0b",
  routine:  "#3b9eff",
};

/* ============================================================
   Team telemetry store — single source of truth for the Team
   lens. TeamView publishes here every animation tick; the
   bottom-sheet ETA chip and the TeamLensRow subscribe so every
   metric (speed, distance left, vitals, next-request countdown)
   updates live as the crew moves toward the destination.
   ============================================================ */
type Telemetry = {
  progress: number;        // 0..1 along primary route
  totalKm: number;         // total trip distance
  totalSec: number;        // total estimated trip seconds
  elapsedSec: number;      // since trip start (this session)
  speedKmh: number;        // instantaneous, with noise + slowdown near end
  hr: number;              // patient HR
  spo2: number;            // %
  bpSys: number;
  bpDia: number;
  gcs: number;
};
const DEFAULT_TOTAL_KM = 8.4;
const DEFAULT_TOTAL_SEC = 12 * 60 + 30; // ~12:30 baseline
let TELEM: Telemetry = {
  progress: 0,
  totalKm: DEFAULT_TOTAL_KM,
  totalSec: DEFAULT_TOTAL_SEC,
  elapsedSec: 0,
  speedKmh: 62,
  hr: 132,
  spo2: 91,
  bpSys: 92,
  bpDia: 58,
  gcs: 11,
};
const telemListeners = new Set<() => void>();
function setTelemetry(patch: Partial<Telemetry>) {
  TELEM = { ...TELEM, ...patch };
  telemListeners.forEach((l) => l());
}
function subscribeTelemetry(l: () => void) {
  telemListeners.add(l);
  return () => telemListeners.delete(l);
}
function useTelemetry() {
  return useSyncExternalStore(subscribeTelemetry, () => TELEM, () => TELEM);
}
function fmtClock(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
function fmtMinSec(totalSec: number) {
  const s = Math.max(0, Math.ceil(totalSec));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/* ---------- Google Maps loader (singleton) ---------- */
declare global {
  interface Window {
    google?: typeof google;
    __velomedMapsCallback?: () => void;
    __velomedMapsLoading?: Promise<void>;
    __velomedMapsFailed?: boolean;
    gm_authFailure?: () => void;
  }
}

/* ---------- Failure plumbing: suppress Google's modal + signal views ---------- */
const MAPS_FAILED_EVENT = "velomed:maps-failed";
function markMapsFailed() {
  if (typeof window === "undefined") return;
  if (window.__velomedMapsFailed) return;
  window.__velomedMapsFailed = true;
  window.dispatchEvent(new CustomEvent(MAPS_FAILED_EVENT));
}
function installMapsErrorGuards() {
  if (typeof window === "undefined") return;
  if ((window as any).__velomedMapsGuards) return;
  (window as any).__velomedMapsGuards = true;
  // Auth / referrer / invalid key errors fire this hook.
  window.gm_authFailure = () => markMapsFailed();
  // Billing-not-enabled and similar errors inject a fixed overlay div with
  // class `gm-err-container` (or similar) into <body>. Strip it and signal.
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        const html = n.outerHTML || "";
        const looksLikeMapsError =
          n.classList?.contains("gm-err-container") ||
          n.querySelector?.(".gm-err-container, .gm-err-content") ||
          /This page can't load Google Maps correctly/i.test(n.textContent || "") ||
          /BillingNotEnabledMapError|ApiNotActivatedMapError|InvalidKeyMapError|RefererNotAllowedMapError/i.test(html);
        if (looksLikeMapsError) {
          n.remove();
          markMapsFailed();
        }
      });
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}
function useMapsFailed() {
  const [failed, setFailed] = useState<boolean>(
    typeof window !== "undefined" && !!window.__velomedMapsFailed,
  );
  useEffect(() => {
    installMapsErrorGuards();
    const onFail = () => setFailed(true);
    window.addEventListener(MAPS_FAILED_EVENT, onFail);
    return () => window.removeEventListener(MAPS_FAILED_EVENT, onFail);
  }, []);
  return failed;
}

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  installMapsErrorGuards();
  if (window.__velomedMapsFailed) return Promise.reject(new Error("maps_failed"));
  if (window.google?.maps) return Promise.resolve();
  if (window.__velomedMapsLoading) return window.__velomedMapsLoading;
  const key = (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ?? "";
  const ch  = (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined) ?? "";
  if (!key) { markMapsFailed(); return Promise.reject(new Error("maps_no_key")); }
  window.__velomedMapsLoading = new Promise<void>((resolve, reject) => {
    window.__velomedMapsCallback = () => resolve();
    const s = document.createElement("script");
    s.async = true; s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&libraries=geometry&callback=__velomedMapsCallback${ch ? `&channel=${encodeURIComponent(ch)}` : ""}`;
    s.onerror = () => { markMapsFailed(); reject(new Error("Failed to load Google Maps")); };
    document.head.appendChild(s);
  });
  return window.__velomedMapsLoading;
}

export function CommandHero() {
  const [level, setLevel] = useState<Level>("network");
  const [branchId, setBranchId] = useState<string>("eastern");
  const interacted = useRef(false);

  // Auto-demo: network → region → team, once, unless user clicks.
  useEffect(() => {
    const t1 = setTimeout(() => { if (!interacted.current) setLevel("region"); }, 3200);
    const t2 = setTimeout(() => { if (!interacted.current) setLevel("team"); },   6800);
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-hairline bg-background/40">
              <div className="inline-flex self-start rounded-md border border-hairline overflow-hidden mono text-[10px] uppercase tracking-widest shrink-0">
                {(["network","region","team"] as Level[]).map((l) => (
                  <button key={l} onClick={() => go(l)}
                    className={`px-3 py-1.5 transition-colors ${level===l ? "bg-teal text-background font-bold" : "text-muted-foreground hover:bg-panel-elevated"}`}>{l}</button>
                ))}
              </div>
              <Breadcrumb level={level} branch={branch.name} onJump={go} />
            </div>

            <div className="relative aspect-[16/10] bg-[oklch(0.18_0.02_240)]">
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
    <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground flex flex-wrap items-center gap-1 min-w-0">
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
/* ----------------- NETWORK (real Google Maps, kingdom-wide) ----------------- */
function NetworkView({ onPick }: { onPick: (id: string) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [ready, setReady] = useState(false);
  const failed = useMapsFailed();

  useEffect(() => {
    if (failed) { setReady(true); return; }
    let cancel = false;
    loadMaps().then(() => {
      if (cancel || !ref.current) return;
      const map = new google.maps.Map(ref.current, {
        center: { lat: 24.0, lng: 45.0 },
        zoom: 5,
        mapTypeId: google.maps.MapTypeId.HYBRID,
        disableDefaultUI: true,
        gestureHandling: "cooperative",
        backgroundColor: "#0b1220",
      });
      mapRef.current = map;
      for (const b of BRANCHES) {
        const marker = new google.maps.Marker({
          map, position: { lat: b.lat, lng: b.lng }, title: `${b.name} branch`,
          icon: {
            url: branchPin(b.cases),
            scaledSize: new google.maps.Size(64, 64),
            anchor: new google.maps.Point(32, 32),
          },
        });
        marker.addListener("click", () => onPick(b.id));
      }
      setReady(true);
    }).catch(() => setReady(true));
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed]);

  return (
    <div className="absolute inset-0">
      {!failed && <div ref={ref} className="absolute inset-0" />}
      {failed && <NetworkFallback onPick={onPick} />}
      {!failed && !ready && <div className="absolute inset-0 grid place-items-center mono text-[10px] uppercase tracking-widest text-muted-foreground">Loading satellite…</div>}
      <div className="absolute top-3 left-3 rounded-full bg-white text-slate-900 shadow-md px-3 py-1.5 text-[12px] font-medium flex items-center gap-2">
        <span className="size-2 rounded-full bg-teal-500" /> 5 branches · 103 active cases · 144 teams
      </div>
      <div className="absolute top-3 right-3 flex flex-col gap-2">
        <button className="size-9 rounded-full bg-white shadow-md grid place-items-center text-slate-700" aria-label="Layers"><Layers className="size-4" /></button>
      </div>
      <div className="absolute bottom-3 right-3 flex flex-col gap-2">
        <button className="size-9 rounded-full bg-white shadow-md grid place-items-center text-slate-700"><Compass className="size-4" /></button>
      </div>
    </div>
  );
}

function branchPin(cases: number) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'>
    <circle cx='32' cy='32' r='22' fill='#3b9eff' fill-opacity='0.18'/>
    <circle cx='32' cy='32' r='14' fill='white' stroke='#1e40af' stroke-width='3'/>
    <text x='32' y='37' text-anchor='middle' font-family='Inter,system-ui' font-size='14' font-weight='700' fill='#1e40af'>${cases}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* ----------------- REGION (real Google Maps satellite + live cases) ----------------- */
function RegionView({ branch, onPickTeam }: { branch: Branch; onPickTeam: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const failed = useMapsFailed();

  useEffect(() => {
    if (failed) return;
    let cancel = false;
    loadMaps().then(() => {
      if (cancel || !ref.current) return;
      const map = new google.maps.Map(ref.current, {
        center: { lat: branch.lat, lng: branch.lng },
        zoom: 9,
        mapTypeId: google.maps.MapTypeId.HYBRID,
        disableDefaultUI: true,
        zoomControl: false,
        backgroundColor: "#0b1220",
      });
      mapRef.current = map;
      for (const d of EASTERN_DISTRICTS) {
        new google.maps.Marker({
          map, position: { lat: d.lat, lng: d.lng },
          icon: { url: districtLabel(d.name), scaledSize: new google.maps.Size(d.name.length * 7 + 24, 22), anchor: new google.maps.Point((d.name.length * 7 + 24) / 2, 11) },
        });
      }
      for (const c of EASTERN_CASES) {
        const m = new google.maps.Marker({
          map, position: { lat: c.lat, lng: c.lng }, title: `${c.id} · ${c.district}`,
          icon: { url: casePin(SEV_COLOR[c.severity]), scaledSize: new google.maps.Size(36, 36), anchor: new google.maps.Point(18, 18) },
        });
        m.addListener("click", onPickTeam);
      }
    }).catch(() => {});
    return () => { cancel = true; };
  }, [branch.lat, branch.lng, onPickTeam, failed]);

  const zoomBy = (delta: number) => mapRef.current?.setZoom((mapRef.current?.getZoom() ?? 9) + delta);

  return (
    <div className="absolute inset-0">
      {!failed && <div ref={ref} className="absolute inset-0" />}
      {failed && <RegionFallback branch={branch} onPickTeam={onPickTeam} />}
      {/* Top left badge */}
      <div className="absolute top-3 left-3 rounded-full bg-white text-slate-900 shadow-md px-3 py-1.5 text-[12px] font-medium flex items-center gap-2">
        <MapPin className="size-3.5 text-rose-500" /> {branch.name} Region · {EASTERN_CASES.length} live · {branch.teams} teams
      </div>
      {/* Legend (Google-style pill row) */}
      <div className="absolute bottom-3 left-3 rounded-full bg-white text-slate-900 shadow-md px-3 py-1.5 text-[11px] flex items-center gap-3">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: SEV_COLOR.critical }} /> Critical</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: SEV_COLOR.transfer }} /> Transfer</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: SEV_COLOR.routine }} /> Routine</span>
      </div>
      {/* Zoom controls (Google-style) */}
      <div className="absolute top-3 right-3 flex flex-col rounded-md bg-white shadow-md overflow-hidden">
        <button onClick={() => zoomBy(1)} className="size-9 grid place-items-center text-slate-700 hover:bg-slate-100" aria-label="Zoom in"><Plus className="size-4" /></button>
        <div className="h-px bg-slate-200" />
        <button onClick={() => zoomBy(-1)} className="size-9 grid place-items-center text-slate-700 hover:bg-slate-100" aria-label="Zoom out"><Minus className="size-4" /></button>
      </div>
      <div className="absolute bottom-3 right-3">
        <button className="size-9 rounded-full bg-white shadow-md grid place-items-center text-slate-700"><Compass className="size-4" /></button>
      </div>
    </div>
  );
}

function districtLabel(name: string) {
  const w = name.length * 7 + 24;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='22' viewBox='0 0 ${w} 22'>
    <rect x='1' y='1' width='${w - 2}' height='20' rx='10' fill='white' opacity='0.92' stroke='#cbd5e1'/>
    <text x='${w / 2}' y='15' text-anchor='middle' font-family='Inter,system-ui' font-size='11' font-weight='600' fill='#0f172a'>${name}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function casePin(color: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'>
    <circle cx='18' cy='18' r='14' fill='${color}' fill-opacity='0.25'>
      <animate attributeName='r' values='10;15;10' dur='1.8s' repeatCount='indefinite'/>
    </circle>
    <circle cx='18' cy='18' r='7' fill='${color}' stroke='white' stroke-width='2'/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* ----------------- TEAM (real Google Maps + Directions, mirrors Google Maps mobile) ----------------- */
function TeamView() {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const vehicleRef = useRef<google.maps.Marker | null>(null);
  const travelledRef = useRef<google.maps.Polyline | null>(null);
  const lastHeadingRef = useRef<number>(0);
  const lastPosRef = useRef<google.maps.LatLng | null>(null);
  const [routes, setRoutes] = useState<{ path: google.maps.LatLng[]; minutes: number }[]>([]);
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState<string>("12:30");
  const tripStartRef = useRef<number>(performance.now());
  const failed = useMapsFailed();

  useEffect(() => {
    if (failed) return;
    let cancel = false;
    loadMaps().then(() => {
      if (cancel || !ref.current) return;
      const map = new google.maps.Map(ref.current, {
        center: { lat: (TEAM_A.lat + TEAM_B.lat) / 2, lng: (TEAM_A.lng + TEAM_B.lng) / 2 },
        zoom: 12,
        mapTypeId: google.maps.MapTypeId.HYBRID,
        disableDefaultUI: true,
        backgroundColor: "#0b1220",
      });
      mapRef.current = map;

      // Destination teardrop (Google red pin look)
      new google.maps.Marker({
        map, position: TEAM_B,
        icon: {
          url: destPin(),
          scaledSize: new google.maps.Size(44, 56),
          anchor: new google.maps.Point(22, 52),
        },
      });
      // Origin "you are here" gray dot
      new google.maps.Marker({
        map, position: TEAM_A,
        icon: { url: originDot(), scaledSize: new google.maps.Size(28, 28), anchor: new google.maps.Point(14, 14) },
      });

      // Vehicle (teal)
      vehicleRef.current = new google.maps.Marker({
        map, position: TEAM_A,
        icon: { url: ambulanceIcon(0), scaledSize: new google.maps.Size(56, 56), anchor: new google.maps.Point(28, 28) },
        zIndex: 999,
      });

      // Fetch routes (Directions API via JS lib; primary + alternatives).
      const svc = new google.maps.DirectionsService();
      svc.route(
        {
          origin: TEAM_A,
          destination: TEAM_B,
          travelMode: google.maps.TravelMode.DRIVING,
          provideRouteAlternatives: true,
        },
        (res, status) => {
          if (status === "OK" && res?.routes?.length) {
            const all = res.routes.map((r) => ({
              path: r.overview_path,
              minutes: Math.round((r.legs[0]?.duration?.value ?? 0) / 60),
            }));
            // primary first (shortest duration)
            all.sort((a, b) => a.minutes - b.minutes);
            setRoutes(all);
            const leg = res.routes[0].legs[0];
            const totalSec = leg?.duration?.value ?? all[0].minutes * 60;
            const totalKm  = (leg?.distance?.value ?? 8400) / 1000;
            setTelemetry({ totalSec, totalKm, progress: 0, elapsedSec: 0 });
            tripStartRef.current = performance.now();
            setEta(fmtMinSec(totalSec));

            // Alt routes (light translucent blue, behind)
            all.slice(1).forEach((r) =>
              new google.maps.Polyline({
                map, path: r.path,
                strokeColor: "#a5b4fc", strokeOpacity: 0.85, strokeWeight: 7, zIndex: 1,
              })
            );
            // Primary remaining (lighter blue background)
            new google.maps.Polyline({
              map, path: all[0].path,
              strokeColor: "#93c5fd", strokeOpacity: 1, strokeWeight: 9, zIndex: 2,
            });
            // Primary travelled (solid bold blue, will be updated as progress advances)
            travelledRef.current = new google.maps.Polyline({
              map, path: [all[0].path[0]],
              strokeColor: "#1e3a8a", strokeOpacity: 1, strokeWeight: 9, zIndex: 3,
            });

            const bounds = new google.maps.LatLngBounds();
            all[0].path.forEach((p) => bounds.extend(p));
            map.fitBounds(bounds, 56);
          } else {
            // Fallback: straight geodesic + estimate
            const path = [new google.maps.LatLng(TEAM_A.lat, TEAM_A.lng), new google.maps.LatLng(TEAM_B.lat, TEAM_B.lng)];
            setRoutes([{ path, minutes: 12 }]);
            new google.maps.Polyline({ map, path, strokeColor: "#93c5fd", strokeWeight: 9, zIndex: 2, geodesic: true });
            travelledRef.current = new google.maps.Polyline({ map, path: [path[0]], strokeColor: "#1e3a8a", strokeWeight: 9, zIndex: 3, geodesic: true });
          }
        }
      );
    }).catch(() => {});
    return () => { cancel = true; };
  }, [failed]);

  // Animate progress along primary route
  useEffect(() => {
    if (!routes.length) return;
    let raf = 0; let last = performance.now();
    let vitalsAccum = 0;
    const total = routes[0].path.length;
    function tick(t: number) {
      const dt = (t - last) / 1000; last = t;
      setProgress((p) => {
        // Drive the trip from 0 → 1, hold at the destination for a short
        // "arrived" beat, then reset for the next loop. Demo speed: ~28s.
        const lap = Math.max(20, Math.min(120, TELEM.totalSec * 0.12));
        let next = p + dt / lap;
        const arrived = next >= 1;
        if (next >= 1.18) {
          // restart trip cleanly
          tripStartRef.current = t;
          next = 0;
        } else if (arrived) {
          next = 1;
        }
        const idx = Math.max(1, Math.floor(Math.min(next, 0.9999) * total));
        const segment = routes[0].path.slice(0, idx);
        if (travelledRef.current) travelledRef.current.setPath(segment);
        const head = arrived
          ? routes[0].path[routes[0].path.length - 1]
          : segment[segment.length - 1];
        if (head && vehicleRef.current) {
          vehicleRef.current.setPosition(head);
          // Rotate ambulance along bearing of travel
          const prev = lastPosRef.current;
          if (prev && window.google?.maps?.geometry) {
            const heading = google.maps.geometry.spherical.computeHeading(prev, head);
            if (!Number.isNaN(heading) && Math.abs(heading - lastHeadingRef.current) > 4) {
              lastHeadingRef.current = heading;
              vehicleRef.current.setIcon({
                url: ambulanceIcon(heading),
                scaledSize: new google.maps.Size(56, 56),
                anchor: new google.maps.Point(28, 28),
              });
            }
          }
          lastPosRef.current = head;
        }

        // Publish telemetry: speed easing (climb → cruise → slow at arrival),
        // ETA countdown, distance left, elapsed trip time, vitals drift.
        const cruise = 68;
        const startCurve = Math.min(1, next / 0.08);                  // ramp up
        const arrivalCurve = next > 0.85 ? Math.max(0, (1 - Math.min(next, 1)) / 0.15) : 1;
        const noise = Math.sin(t / 700) * 3 + Math.sin(t / 230) * 1.5;
        const speed = arrived ? 0 : Math.max(0, cruise * startCurve * arrivalCurve + noise);
        const elapsed = (t - tripStartRef.current) / 1000;
        const remainSec = arrived ? 0 : Math.max(0, TELEM.totalSec * (1 - next));

        // Patient vitals drift modestly (HR rises slightly under transit,
        // SpO2 holds, BP narrows pulse pressure on critical cases).
        vitalsAccum += dt;
        let vitals: Partial<Telemetry> = {};
        if (vitalsAccum > 1.2) {
          vitalsAccum = 0;
          const hrTrend = 132 + Math.sin(t / 4000) * 6 + (Math.random() - 0.5) * 3;
          const spo2Trend = 91 + Math.sin(t / 6500) * 1.5 + (Math.random() - 0.5);
          vitals = {
            hr: Math.round(hrTrend),
            spo2: Math.max(86, Math.min(96, Math.round(spo2Trend))),
            bpSys: 92 + Math.round(Math.sin(t / 5200) * 4),
            bpDia: 58 + Math.round(Math.sin(t / 4700) * 3),
          };
        }
        setTelemetry({
          progress: Math.min(next, 1),
          speedKmh: speed,
          elapsedSec: elapsed,
          ...vitals,
        });
        setEta(arrived ? "Arrived" : fmtMinSec(remainSec));
        return next;
      });
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [routes]);

  return (
    <div className="absolute inset-0">
      {!failed && <div ref={ref} className="absolute inset-0" />}
      {failed && <TeamFallback eta={eta} progress={progress} />}
      {/* Crew chip */}
      <div className="absolute top-3 left-3 rounded-full bg-white text-slate-900 shadow-md px-3 py-1.5 text-[12px] font-medium flex items-center gap-2">
        <span className="size-2 rounded-full bg-teal-500 animate-pulse" /> Crew 04 · ALS · 2 onboard
      </div>
      {/* Route time bubbles — Google Maps style */}
      {routes.map((r, i) => (
        <RouteBubble key={i} minutes={r.minutes} primary={i === 0} index={i} total={routes.length} />
      ))}
      {/* Bottom sheet: ETA + actions */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-xl bg-white shadow-lg px-4 py-2.5 flex items-center gap-4 text-slate-900 min-w-[260px]">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">ETA · {TEAM_B.label}</div>
          <div className="text-xl font-bold text-blue-700">{eta}</div>
        </div>
        <div className="h-9 w-px bg-slate-200" />
        <div className="flex flex-col text-[11px] text-slate-700">
          <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> {Math.round(Math.min(progress, 1) * 100)}%</span>
          <span className="mono text-slate-500">{Math.max(0, TELEM.totalKm * (1 - Math.min(progress, 1))).toFixed(2)} km left · {Math.round(TELEM.speedKmh)} km/h</span>
        </div>
      </div>
      {/* Compass / layers */}
      <div className="absolute top-3 right-3 flex flex-col gap-2">
        <button className="size-9 rounded-full bg-white shadow-md grid place-items-center text-slate-700"><Layers className="size-4" /></button>
      </div>
      <div className="absolute bottom-3 right-3">
        <button className="size-10 rounded-full bg-white shadow-md grid place-items-center text-slate-700"><Compass className="size-5" /></button>
      </div>
    </div>
  );
}

function RouteBubble({ minutes, primary, index, total }: { minutes: number; primary: boolean; index: number; total: number }) {
  // distribute alternates around upper-center
  const slots = total === 1 ? [{ top: "12%", left: "50%" }]
    : total === 2 ? [{ top: "20%", left: "44%" }, { top: "12%", left: "62%" }]
    : [{ top: "22%", left: "40%" }, { top: "10%", left: "60%" }, { top: "34%", left: "18%" }];
  const s = slots[index] ?? slots[slots.length - 1];
  const cls = primary
    ? "bg-blue-700 text-white border-white"
    : "bg-white text-slate-900 border-slate-200";
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ top: s.top, left: s.left }}>
      <div className={`px-2.5 py-1 rounded-full border shadow-md text-[12px] font-semibold ${cls} flex items-center gap-1.5`}>
        {minutes} min {primary && <span className="inline-block size-1.5 rounded-full bg-emerald-300" />}
      </div>
    </div>
  );
}

/* ---------- Google-style pin / dot data URIs ---------- */
function destPin() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='44' height='56' viewBox='0 0 44 56'>
    <defs><filter id='s' x='-50%' y='-50%' width='200%' height='200%'><feDropShadow dx='0' dy='2' stdDeviation='1.5' flood-color='#000' flood-opacity='0.35'/></filter></defs>
    <path filter='url(#s)' d='M22 2 C10 2 2 10 2 22 c0 14 20 32 20 32 s20-18 20-32 C42 10 34 2 22 2 z' fill='#ea4335' stroke='white' stroke-width='2'/>
    <circle cx='22' cy='21' r='6' fill='white'/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
function originDot() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>
    <circle cx='14' cy='14' r='12' fill='#94a3b8' fill-opacity='0.35'/>
    <circle cx='14' cy='14' r='6' fill='#64748b' stroke='white' stroke-width='2'/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
/** Top-down ambulance icon, rotated by bearing (deg, 0 = north). */
function ambulanceIcon(heading: number) {
  // Top-down ambulance, designed to read cleanly at 56px on retina:
  // bold white body, cyan windshield strip up front, full-width red side
  // stripes, a large red cross, blue/red roof lightbar, and a soft pulse
  // halo. Rotated to match the direction of travel.
  const h = heading.toFixed(1);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'>
    <defs>
      <filter id='amb-sh' x='-50%' y='-50%' width='200%' height='200%'>
        <feDropShadow dx='0' dy='1.2' stdDeviation='1.6' flood-color='#000' flood-opacity='0.55'/>
      </filter>
      <linearGradient id='amb-roof' x1='0' x2='0' y1='0' y2='1'>
        <stop offset='0' stop-color='#ffffff'/>
        <stop offset='1' stop-color='#e2e8f0'/>
      </linearGradient>
    </defs>
    <circle cx='28' cy='28' r='22' fill='#06b6d4' fill-opacity='0.18'>
      <animate attributeName='r' values='18;24;18' dur='1.6s' repeatCount='indefinite'/>
      <animate attributeName='fill-opacity' values='0.32;0.04;0.32' dur='1.6s' repeatCount='indefinite'/>
    </circle>
    <g transform='rotate(${h} 28 28)' filter='url(#amb-sh)'>
      <!-- body / roof -->
      <rect x='16' y='9' width='24' height='38' rx='4.5' fill='url(#amb-roof)' stroke='#0f172a' stroke-width='1.4'/>
      <!-- hood seam -->
      <line x1='16' y1='17' x2='40' y2='17' stroke='#0f172a' stroke-width='0.6' stroke-opacity='0.4'/>
      <!-- windshield (front of vehicle = top in rotation 0) -->
      <path d='M 18 14 Q 28 10 38 14 L 36 17 L 20 17 Z' fill='#7dd3fc' stroke='#0f172a' stroke-width='0.7'/>
      <!-- side red stripes -->
      <rect x='16' y='25' width='24' height='2.8' fill='#ef4444'/>
      <rect x='16' y='34' width='24' height='2.8' fill='#ef4444' fill-opacity='0.55'/>
      <!-- red cross (center) -->
      <rect x='26.7' y='28' width='2.6' height='10' fill='#ffffff' stroke='#ef4444' stroke-width='0.6'/>
      <rect x='23' y='31.7' width='10' height='2.6' fill='#ffffff' stroke='#ef4444' stroke-width='0.6'/>
      <rect x='26.9' y='28.2' width='2.2' height='9.6' fill='#ef4444'/>
      <rect x='23.2' y='31.9' width='9.6' height='2.2' fill='#ef4444'/>
      <!-- roof lightbar -->
      <rect x='19' y='11' width='8' height='2.4' rx='0.8' fill='#ef4444'>
        <animate attributeName='fill' values='#ef4444;#7f1d1d;#ef4444' dur='0.7s' repeatCount='indefinite'/>
      </rect>
      <rect x='29' y='11' width='8' height='2.4' rx='0.8' fill='#06b6d4'>
        <animate attributeName='fill' values='#06b6d4;#155e75;#06b6d4' dur='0.7s' repeatCount='indefinite'/>
      </rect>
      <!-- rear bumper hint -->
      <rect x='18' y='44' width='20' height='2' rx='0.8' fill='#0f172a' fill-opacity='0.7'/>
      <!-- wheels -->
      <rect x='13.5' y='20' width='3' height='6' rx='0.8' fill='#0f172a'/>
      <rect x='39.5' y='20' width='3' height='6' rx='0.8' fill='#0f172a'/>
      <rect x='13.5' y='34' width='3' height='6' rx='0.8' fill='#0f172a'/>
      <rect x='39.5' y='34' width='3' height='6' rx='0.8' fill='#0f172a'/>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function TeamLensRow() {
  const t = useTelemetry();
  const remainSec = Math.max(0, t.totalSec * (1 - t.progress));
  const distLeftKm = Math.max(0, t.totalKm * (1 - t.progress));
  // After handoff, the next call lights up as the crew nears destination.
  const nextRespondSec = Math.max(60, 14 * 60 - t.elapsedSec * 0.6);
  const nearArrival = t.progress > 0.9;
  const acuity = t.spo2 < 90 || t.hr > 140 ? "P1 Critical · deteriorating" : "P1 Critical";

  return (
    <div className="border-t border-hairline">
      {/* Live A→B progress bar — feels like a vehicle dashboard */}
      <div className="h-0.5 bg-panel-elevated relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-teal transition-[width] duration-200"
          style={{ width: `${(t.progress * 100).toFixed(2)}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-teal shadow-[0_0_8px_rgba(20,184,166,0.9)]"
          style={{ left: `calc(${(t.progress * 100).toFixed(2)}% - 3px)` }}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3">
        <LensPanel
          title="Movement"
          icon={<Navigation className="size-3.5" />}
          rows={[
            ["Speed", `${Math.round(t.speedKmh)} km/h`],
            ["ETA", fmtMinSec(remainSec)],
            ["Distance left", `${distLeftKm.toFixed(1)} km`],
            ["Trip time", fmtClock(t.elapsedSec)],
            ["A → B progress", `${Math.round(t.progress * 100)}%`],
          ]}
          live
        />
        <LensPanel
          title="Patient onboard"
          icon={<Heart className="size-3.5" />}
          accent="coral"
          rows={[
            ["Acuity", acuity],
            ["HR", `${t.hr} bpm`],
            ["BP", `${t.bpSys} / ${t.bpDia}`],
            ["SpO₂", `${t.spo2}%`],
            ["GCS", `${t.gcs}`],
          ]}
          note={
            nearArrival
              ? "Approaching Al Mana · trauma bay 2 reserved · doors opening"
              : "Suspected internal bleeding · pre-alert sent to trauma bay"
          }
          live
        />
        <LensPanel
          title="Next request"
          icon={<Zap className="size-3.5" />}
          rows={[
            ["Case", "C-2039 · Transfer"],
            ["Pickup", "Dammam Medical Tower"],
            ["Destination", "King Fahd Specialist"],
            ["Time to respond", `~${Math.ceil(nextRespondSec / 60)} min`],
            ["After handoff", nearArrival ? "Dispatch ready" : "Auto-queue"],
          ]}
        />
      </div>
    </div>
  );
}

function LensPanel({ title, icon, rows, note, accent = "teal", live = false }: { title: string; icon: React.ReactNode; rows: [string, string][]; note?: string; accent?: "teal" | "coral"; live?: boolean }) {
  const accentClass = accent === "coral" ? "text-coral" : "text-teal";
  return (
    <div className="p-4 border-r border-hairline last:border-r-0">
      <div className={`mono text-[10px] uppercase tracking-widest ${accentClass} flex items-center gap-1.5`}>
        {icon}{title}
        {live && (
          <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
            <span className="size-1.5 rounded-full bg-teal animate-pulse" /> LIVE
          </span>
        )}
      </div>
      <dl className="mt-3 space-y-1.5">
        {rows.map(([k,v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 tabular-nums">
            <dt className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</dt>
            <dd className="mono text-sm font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-3 text-xs text-muted-foreground italic border-l-2 border-hairline pl-2">{note}</p>}
    </div>
  );
}

/* ============================================================
   Fallback satellite-style panels (used when Google Maps fails
   to load — invalid key, billing not enabled, referrer block).
   These mirror the real layout so the hero still feels alive.
   ============================================================ */

const SAT_BG: React.CSSProperties = {
  backgroundColor: "#0b1f2a",
  backgroundImage:
    // soft satellite-like blotches + city glow + grid
    "radial-gradient(60% 50% at 20% 30%, rgba(34,197,94,0.18), transparent 60%)," +
    "radial-gradient(50% 40% at 75% 65%, rgba(234,179,8,0.14), transparent 60%)," +
    "radial-gradient(35% 30% at 55% 20%, rgba(56,189,248,0.16), transparent 60%)," +
    "radial-gradient(40% 35% at 30% 80%, rgba(244,114,182,0.10), transparent 60%)," +
    "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)," +
    "linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
  backgroundSize: "auto, auto, auto, auto, 40px 40px, 40px 40px",
};

function FallbackChrome({ children }: { children?: React.ReactNode }) {
  return (
    <div className="absolute inset-0" style={SAT_BG}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(120% 80% at 50% 50%, transparent 50%, rgba(0,0,0,0.55) 100%)" }} />
      {children}
      <div className="absolute bottom-1 right-2 mono text-[9px] uppercase tracking-widest text-white/40">
        Offline preview · enable Maps billing for live satellite
      </div>
    </div>
  );
}

function NetworkFallback({ onPick }: { onPick: (id: string) => void }) {
  // Positions roughly mirror KSA branch geography on the rect.
  const pts: Record<string, { top: string; left: string }> = {
    northern: { top: "16%", left: "30%" },
    western:  { top: "58%", left: "22%" },
    southern: { top: "78%", left: "40%" },
    central:  { top: "46%", left: "52%" },
    eastern:  { top: "40%", left: "76%" },
  };
  return (
    <FallbackChrome>
      {BRANCHES.map((b) => {
        const p = pts[b.id];
        return (
          <button key={b.id} onClick={() => onPick(b.id)}
            className="absolute -translate-x-1/2 -translate-y-1/2 group"
            style={{ top: p.top, left: p.left }}>
            <span className="absolute inset-0 -m-3 rounded-full bg-sky-400/20 animate-pulse" />
            <span className="relative grid place-items-center size-12 rounded-full bg-white border-2 border-blue-700 text-blue-900 font-bold text-sm shadow-lg">
              {b.cases}
            </span>
            <span className="block mono text-[9px] uppercase tracking-widest text-white/80 mt-1.5 text-center">{b.name}</span>
          </button>
        );
      })}
    </FallbackChrome>
  );
}

function RegionFallback({ branch, onPickTeam }: { branch: Branch; onPickTeam: () => void }) {
  const cases = EASTERN_CASES.slice(0, 6).map((c, i) => ({
    ...c,
    top: `${18 + (i % 3) * 26}%`,
    left: `${20 + Math.floor(i / 3) * 32 + (i % 2) * 14}%`,
  }));
  return (
    <FallbackChrome>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mono text-[10px] uppercase tracking-[0.3em] text-white/30">
        {branch.name} · region
      </div>
      {cases.map((c) => (
        <button key={c.id} onClick={onPickTeam}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ top: c.top, left: c.left }}>
          <span className="absolute inset-0 -m-3 rounded-full animate-ping"
            style={{ background: SEV_COLOR[c.severity], opacity: 0.25 }} />
          <span className="relative block size-3.5 rounded-full border-2 border-white shadow"
            style={{ background: SEV_COLOR[c.severity] }} />
          <span className="block mono text-[9px] text-white/80 mt-1 whitespace-nowrap">{c.id}</span>
        </button>
      ))}
    </FallbackChrome>
  );
}

function TeamFallback({ eta, progress }: { eta: string; progress: number }) {
  // Drive the shared telemetry store so the lens row animates even when
  // Google Maps fails (billing/key/referrer). A 60s loop with the same
  // ease curves used by the real map keeps the dashboard alive.
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    let tripStart = start;
    setTelemetry({ totalSec: 12 * 60 + 30, totalKm: 8.4 });
    const loop = (t: number) => {
      const elapsed = (t - tripStart) / 1000;
      const lap = 28; // seconds per trip in fallback demo
      let next = elapsed / lap;
      const arrived = next >= 1;
      if (next >= 1.25) { tripStart = t; next = 0; }
      else if (arrived) { next = 1; }
      const startCurve = Math.min(1, next / 0.08);
      const arrivalCurve = next > 0.85 ? Math.max(0, (1 - Math.min(next, 1)) / 0.15) : 1;
      const noise = Math.sin(t / 700) * 3 + Math.sin(t / 230) * 1.5;
      setTelemetry({
        progress: Math.min(next, 1),
        elapsedSec: elapsed,
        speedKmh: arrived ? 0 : Math.max(0, 68 * startCurve * arrivalCurve + noise),
        hr: Math.round(132 + Math.sin(t / 4000) * 6),
        spo2: Math.max(86, Math.min(96, Math.round(91 + Math.sin(t / 6500) * 1.5))),
        bpSys: 92 + Math.round(Math.sin(t / 5200) * 4),
        bpDia: 58 + Math.round(Math.sin(t / 4700) * 3),
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // SVG mock route A→B with travelled segment + alternates.
  // Allow the full 0..1 range so the dashboard actually shows arrival.
  const pct = Math.max(0, Math.min(1, progress || 0));
  const arrived = pct >= 0.999;
  // Position the ambulance manually along the path so it can sit exactly
  // at the destination on arrival, instead of looping with animateMotion.
  // Cubic Bezier P0(60,200) P1(160,200) P2(220,130) P3(340,70).
  const bezier = (u: number) => {
    const mu = 1 - u;
    const x = mu*mu*mu*60 + 3*mu*mu*u*160 + 3*mu*u*u*220 + u*u*u*340;
    const y = mu*mu*mu*200 + 3*mu*mu*u*200 + 3*mu*u*u*130 + u*u*u*70;
    return { x, y };
  };
  const p1 = bezier(Math.max(0.0001, pct));
  const p0 = bezier(Math.max(0, pct - 0.02));
  const angle = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI + 90;
  return (
    <FallbackChrome>
      <svg viewBox="0 0 400 250" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        {/* alternates */}
        <path d="M 60 200 C 140 180, 200 100, 340 70" stroke="#a5b4fc" strokeWidth="6" strokeOpacity="0.55" fill="none" strokeLinecap="round" />
        <path d="M 60 200 C 120 220, 260 200, 340 70" stroke="#a5b4fc" strokeWidth="6" strokeOpacity="0.45" fill="none" strokeLinecap="round" />
        {/* primary remaining (light blue) */}
        <path id="primary" d="M 60 200 C 160 200, 220 130, 340 70" stroke="#93c5fd" strokeWidth="9" fill="none" strokeLinecap="round" />
        {/* primary travelled (dark blue), drawn via stroke-dasharray trick */}
        <path d="M 60 200 C 160 200, 220 130, 340 70"
          stroke="#1e3a8a" strokeWidth="9" fill="none" strokeLinecap="round"
          pathLength={1} strokeDasharray={`${pct} 1`} />
        {/* origin */}
        <circle cx="60" cy="200" r="9" fill="#64748b" stroke="white" strokeWidth="3" />
        {/* destination teardrop */}
        <g transform="translate(340 70)">
          <path d="M 0 -28 C -12 -28, -20 -20, -20 -8 C -20 6, 0 24, 0 24 S 20 6, 20 -8 C 20 -20, 12 -28, 0 -28 Z"
            fill="#ea4335" stroke="white" strokeWidth="2" />
          <circle cx="0" cy="-10" r="5" fill="white" />
        </g>
        {/* ambulance — positioned by progress so it can sit at destination */}
        <g transform={`translate(${p1.x} ${p1.y})`}>
          <circle r="14" fill="#06b6d4" fillOpacity="0.22">
            <animate attributeName="r" values="11;15;11" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="fill-opacity" values="0.35;0.05;0.35" dur="1.6s" repeatCount="indefinite" />
          </circle>
          <g transform={`rotate(${angle.toFixed(1)})`}>
            <rect x="-8" y="-12" width="16" height="24" rx="3" fill="#ffffff" stroke="#0f172a" strokeWidth="1.2" />
            <path d="M -7 -8 Q 0 -11 7 -8 L 6 -6 L -6 -6 Z" fill="#7dd3fc" stroke="#0f172a" strokeWidth="0.5" />
            <rect x="-8" y="-2" width="16" height="2" fill="#ef4444" />
            <rect x="-1" y="1" width="2" height="8" fill="#ef4444" />
            <rect x="-4.5" y="4" width="9" height="2" fill="#ef4444" />
            <rect x="-6.5" y="-11" width="5" height="1.6" rx="0.4" fill="#ef4444" />
            <rect x="1.5" y="-11" width="5" height="1.6" rx="0.4" fill="#06b6d4" />
          </g>
        </g>
      </svg>
      {/* time bubbles */}
      <div className="absolute" style={{ top: "12%", left: "62%" }}>
        <div className="px-2.5 py-1 rounded-full border border-white bg-blue-700 text-white shadow-md text-[12px] font-semibold flex items-center gap-1.5">
          {arrived ? "Arrived" : eta} <span className="inline-block size-1.5 rounded-full bg-emerald-300" />
        </div>
      </div>
      <div className="absolute" style={{ top: "30%", left: "42%" }}>
        <div className="px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-900 shadow-md text-[12px] font-semibold">7 min</div>
      </div>
      <div className="absolute bottom-3 left-3 mono text-[9px] uppercase tracking-widest text-white/60 flex items-center gap-1.5">
        <Radio className="size-3 text-teal" /> Crew 04 · A → B · {Math.round(pct * 100)}%
      </div>
    </FallbackChrome>
  );
}
