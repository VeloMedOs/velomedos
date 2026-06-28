/// <reference types="google.maps" />
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Heart, Stethoscope, Navigation, Clock, MapPin, Zap, Compass, Layers, Plus, Minus, Radio, Activity, Gauge, Siren, Wind, Wifi } from "lucide-react";
import { BRAND as SHARED_BRAND } from "@/lib/brand";

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
  critical: "#FF6E5B",
  transfer: "#F5B544",
  routine:  "#4FB6F7",
};

// VeloMed brand palette — re-exported from the shared brand module so every
// map overlay (routes, pins, halos, pills) reads as one system across the app.
const BRAND = SHARED_BRAND;

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
function fmtHHMM(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
/** Shortest signed angular delta in degrees, normalized to (-180, 180]. */
function shortestAngleDelta(from: number, to: number) {
  let d = ((to - from) % 360 + 540) % 360 - 180;
  return d;
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
        <button aria-label="Reset map orientation" className="size-9 rounded-full bg-white shadow-md grid place-items-center text-slate-700"><Compass className="size-4" /></button>
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
        <button aria-label="Reset map orientation" className="size-9 rounded-full bg-white shadow-md grid place-items-center text-slate-700"><Compass className="size-4" /></button>
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
  const targetHeadingRef = useRef<number>(0);
  const smoothedHeadingRef = useRef<number>(0);
  const appliedHeadingRef = useRef<number>(0);
  const lastPosRef = useRef<google.maps.LatLng | null>(null);
  const [routes, setRoutes] = useState<{ path: google.maps.LatLng[]; minutes: number }[]>([]);
  const [, setProgressTick] = useState(0);
  const progressRef = useRef(0);
  const tel = useTelemetry();
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
            progressRef.current = 0;

            // Alt routes (faded brand blue, behind)
            all.slice(1).forEach((r) =>
              new google.maps.Polyline({
                map, path: r.path,
                strokeColor: BRAND.blueSoft, strokeOpacity: 0.85, strokeWeight: 7, zIndex: 1,
              })
            );
            // Primary remaining (brand blue, Google-route weight)
            new google.maps.Polyline({
              map, path: all[0].path,
              strokeColor: BRAND.blue, strokeOpacity: 1, strokeWeight: 9, zIndex: 2,
            });
            // Primary travelled (deep brand blue, advances with the crew)
            travelledRef.current = new google.maps.Polyline({
              map, path: [all[0].path[0]],
              strokeColor: BRAND.blueDeep, strokeOpacity: 1, strokeWeight: 9, zIndex: 3,
            });

            const bounds = new google.maps.LatLngBounds();
            all[0].path.forEach((p) => bounds.extend(p));
            map.fitBounds(bounds, 56);
          } else {
            // Fallback: straight geodesic + estimate
            const path = [new google.maps.LatLng(TEAM_A.lat, TEAM_A.lng), new google.maps.LatLng(TEAM_B.lat, TEAM_B.lng)];
            setRoutes([{ path, minutes: 12 }]);
            new google.maps.Polyline({ map, path, strokeColor: BRAND.blue, strokeWeight: 9, zIndex: 2, geodesic: true });
            travelledRef.current = new google.maps.Polyline({ map, path: [path[0]], strokeColor: BRAND.blueDeep, strokeWeight: 9, zIndex: 3, geodesic: true });
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
      // Drive the trip from 0 → 1, hold at the destination for a short
      // "arrived" beat, then reset for the next loop.
      const lap = Math.max(20, Math.min(120, TELEM.totalSec * 0.12));
      const p = progressRef.current;
      let next = p + dt / lap;
      const arrived = next >= 1;
      const justLooped = next >= 1.18;
      if (justLooped) {
        tripStartRef.current = t;
        next = 0;
        lastPosRef.current = null;
      } else if (arrived) {
        next = 1;
      }
      progressRef.current = next;
      const idx = arrived
        ? total
        : Math.max(1, Math.floor(Math.min(next, 0.9999) * total));
      const segment = routes[0].path.slice(0, idx);
      if (travelledRef.current) travelledRef.current.setPath(segment);
      const head = arrived
        ? routes[0].path[routes[0].path.length - 1]
        : segment[segment.length - 1];
      if (head && vehicleRef.current) {
        vehicleRef.current.setPosition(head);
        // Target bearing from the previous frame's position.
        const prev = lastPosRef.current;
        if (prev && window.google?.maps?.geometry && !arrived) {
          const heading = google.maps.geometry.spherical.computeHeading(prev, head);
          if (!Number.isNaN(heading)) targetHeadingRef.current = heading;
        }
        // Ease smoothed bearing toward target along the shortest arc.
        const alpha = Math.min(1, dt * 6); // ~166ms time-constant
        const delta = shortestAngleDelta(smoothedHeadingRef.current, targetHeadingRef.current);
        smoothedHeadingRef.current = smoothedHeadingRef.current + delta * alpha;
        // Only repaint the icon when the displayed bearing actually moves a
        // noticeable amount — avoids re-encoding the SVG every frame.
        if (Math.abs(shortestAngleDelta(appliedHeadingRef.current, smoothedHeadingRef.current)) > 1.5) {
          appliedHeadingRef.current = smoothedHeadingRef.current;
          vehicleRef.current.setIcon({
            url: ambulanceIcon(smoothedHeadingRef.current),
            scaledSize: new google.maps.Size(56, 56),
            anchor: new google.maps.Point(28, 28),
          });
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
      setProgressTick((n) => (n + 1) & 0xffff);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [routes]);

  return (
    <div className="absolute inset-0">
      {!failed && <div ref={ref} className="absolute inset-0" />}
      {failed && <TeamFallback />}
      {!failed && (
        <>
          {/* Crew chip */}
          <div data-debug-id="team-crew-chip" className="absolute top-3 left-3 z-[40] max-w-[calc(100%-96px)] rounded-full bg-white text-slate-900 shadow-md px-3 py-1.5 text-[11px] sm:text-[12px] font-medium flex items-center gap-2 truncate">
            <span className="size-2 rounded-full animate-pulse" style={{ background: BRAND.teal }} /> Crew 04 · ALS · 2 onboard
          </div>
          {/* Route time bubbles — Google Maps style */}
          {routes.map((r, i) => (
            <RouteBubble key={i} minutes={r.minutes} primary={i === 0} index={i} total={routes.length} />
          ))}
          {/* Bottom sheet: ETA + telemetry — elite glass card */}
          <div
            data-debug-id="team-eta-bubble"
            className="absolute bottom-3 left-3 right-16 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[40] rounded-[22px] p-[1px] bg-gradient-to-br from-white/80 via-white/30 to-white/10 sm:w-[320px]"
            style={{
              boxShadow: tel.progress >= 0.999
                ? "0 12px 42px -12px rgba(40,214,182,0.38)"
                : "0 12px 42px -12px rgba(79,182,247,0.35)",
            }}
          >
            <div className="relative rounded-[21px] bg-white/20 backdrop-blur-xl px-4 py-3 flex items-center justify-between gap-3 text-slate-900 overflow-hidden">
              {/* subtle readability wash */}
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-white/25 via-white/5 to-transparent" />
              {/* subtle progress wash at bottom */}
              <div
                className="absolute bottom-0 left-0 h-[3px] transition-[width] duration-300"
                style={{
                  width: `${Math.round(Math.min(tel.progress, 1) * 100)}%`,
                  background: tel.progress >= 0.999
                    ? "linear-gradient(90deg, #28D6B6, #4FB6F7)"
                    : "linear-gradient(90deg, #4FB6F7, #1F6FEB)",
                  boxShadow: tel.progress >= 0.999
                    ? "0 0 14px rgba(40,214,182,0.5)"
                    : "0 0 14px rgba(79,182,247,0.5)",
                }}
              />
              <div className="relative min-w-0" style={{ textShadow: "0 1px 1px rgba(255,255,255,0.65)" }}>
                <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-500/90 leading-none mb-1">
                  ETA · {TEAM_B.label}
                </div>
                <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-tight leading-tight truncate">
                  General Hospital
                </div>
                <div
                  className="text-[34px] font-bold tracking-tighter leading-none mt-1"
                  style={{ color: tel.progress >= 0.999 ? BRAND.tealDeep : BRAND.blueDeep, fontVariantNumeric: "tabular-nums" }}
                >
                  {tel.progress >= 0.999 ? "Arrived" : fmtMinSec(tel.totalSec * (1 - tel.progress))}
                </div>
              </div>
              <div className="relative flex flex-col items-end text-[10px] text-slate-700 leading-tight min-w-0"
                style={{ textShadow: "0 1px 1px rgba(255,255,255,0.65)", fontVariantNumeric: "tabular-nums" }}>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Clock className="size-3.5" style={{ color: tel.progress >= 0.999 ? BRAND.tealDeep : BRAND.blueDeep }} />
                  {Math.round(Math.min(tel.progress, 1) * 100)}%
                </span>
                <span className="mono text-slate-500">{Math.max(0, tel.totalKm * (1 - Math.min(tel.progress, 1))).toFixed(2)} km left</span>
                <span className="mono text-slate-500">{Math.round(tel.speedKmh)} km/h</span>
              </div>
            </div>
          </div>
          {/* Compass / layers */}
          <div className="absolute top-3 right-3 z-[45] flex flex-col gap-2">
            <button aria-label="Map layers" className="size-9 rounded-full bg-white shadow-md grid place-items-center text-slate-700"><Layers className="size-4" /></button>
          </div>
          <div className="absolute bottom-3 right-3 z-[45]">
            <button aria-label="Reset map orientation" className="size-10 rounded-full bg-white shadow-md grid place-items-center text-slate-700"><Compass className="size-5" /></button>
          </div>
        </>
      )}
    </div>
  );
}

function RouteBubble({ minutes, primary, index, total }: { minutes: number; primary: boolean; index: number; total: number }) {
  const tel = useTelemetry();
  const arrived = primary && tel.progress >= 0.999;
  // distribute alternates around upper-center
  const slots = total === 1 ? [{ top: "12%", left: "50%" }]
    : total === 2 ? [{ top: "20%", left: "44%" }, { top: "12%", left: "62%" }]
    : [{ top: "22%", left: "40%" }, { top: "10%", left: "60%" }, { top: "34%", left: "18%" }];
  const s = slots[index] ?? slots[slots.length - 1];
  const innerStyle: React.CSSProperties = primary
    ? { background: arrived ? BRAND.teal : BRAND.blueDeep, color: arrived ? BRAND.ink : "#fff" }
    : { background: "rgba(255,255,255,0.82)", color: "#0f172a" };
  const wrapperStyle: React.CSSProperties = primary
    ? { background: "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.25) 100%)", boxShadow: "0 6px 18px -6px rgba(79,182,247,0.38)" }
    : { background: "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.15) 100%)", boxShadow: "0 6px 14px -6px rgba(8,11,17,0.25)" };
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ top: s.top, left: s.left }}>
      <div className="rounded-full p-[1px]" style={wrapperStyle}>
        <div className="px-2.5 py-1 rounded-full border border-white/50 text-[12px] font-semibold flex items-center gap-1.5" style={innerStyle}>
          {arrived ? "Arrived" : `${minutes} min`}
          {primary && (
            <span
              className="inline-block size-1.5 rounded-full"
              style={{ background: arrived ? BRAND.ink : BRAND.teal }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Google-style pin / dot data URIs ---------- */
function destPin() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='44' height='56' viewBox='0 0 44 56'>
    <defs><filter id='s' x='-50%' y='-50%' width='200%' height='200%'><feDropShadow dx='0' dy='2' stdDeviation='1.5' flood-color='#000' flood-opacity='0.35'/></filter></defs>
    <path filter='url(#s)' d='M22 2 C10 2 2 10 2 22 c0 14 20 32 20 32 s20-18 20-32 C42 10 34 2 22 2 z' fill='#FF6E5B' stroke='white' stroke-width='2'/>
    <g transform='translate(13 12)'>
      <rect x='3' y='3' width='12' height='10' rx='1.5' fill='white'/>
      <rect x='6' y='1' width='6' height='3' rx='0.6' fill='white'/>
      <rect x='8.2' y='5' width='1.6' height='6' fill='#FF6E5B'/>
      <rect x='6' y='7.2' width='6' height='1.6' fill='#FF6E5B'/>
    </g>
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
    <circle cx='28' cy='28' r='22' fill='#28D6B6' fill-opacity='0.20'>
      <animate attributeName='r' values='18;24;18' dur='1.6s' repeatCount='indefinite'/>
      <animate attributeName='fill-opacity' values='0.32;0.04;0.32' dur='1.6s' repeatCount='indefinite'/>
    </circle>
    <g transform='rotate(${h} 28 28)' filter='url(#amb-sh)'>
      <!-- body / roof -->
      <rect x='16' y='9' width='24' height='38' rx='4.5' fill='url(#amb-roof)' stroke='#0f172a' stroke-width='1.4'/>
      <!-- hood seam -->
      <line x1='16' y1='17' x2='40' y2='17' stroke='#0f172a' stroke-width='0.6' stroke-opacity='0.4'/>
      <!-- windshield (front of vehicle = top in rotation 0) -->
      <path d='M 18 14 Q 28 10 38 14 L 36 17 L 20 17 Z' fill='#4FB6F7' stroke='#0f172a' stroke-width='0.7'/>
      <!-- side red stripes -->
      <rect x='16' y='25' width='24' height='2.8' fill='#FF6E5B'/>
      <rect x='16' y='34' width='24' height='2.8' fill='#FF6E5B' fill-opacity='0.55'/>
      <!-- red cross (center) -->
      <rect x='26.7' y='28' width='2.6' height='10' fill='#ffffff' stroke='#FF6E5B' stroke-width='0.6'/>
      <rect x='23' y='31.7' width='10' height='2.6' fill='#ffffff' stroke='#FF6E5B' stroke-width='0.6'/>
      <rect x='26.9' y='28.2' width='2.2' height='9.6' fill='#FF6E5B'/>
      <rect x='23.2' y='31.9' width='9.6' height='2.2' fill='#FF6E5B'/>
      <!-- roof lightbar -->
      <rect x='19' y='11' width='8' height='2.4' rx='0.8' fill='#FF6E5B'>
        <animate attributeName='fill' values='#FF6E5B;#7a2a20;#FF6E5B' dur='0.7s' repeatCount='indefinite'/>
      </rect>
      <rect x='29' y='11' width='8' height='2.4' rx='0.8' fill='#28D6B6'>
        <animate attributeName='fill' values='#28D6B6;#0f5b4d;#28D6B6' dur='0.7s' repeatCount='indefinite'/>
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
  const nextRespondSec = Math.max(60, 14 * 60 - t.elapsedSec * 0.6);
  const nearArrival = t.progress > 0.9;
  const arrived = t.progress >= 0.999;
  const deteriorating = t.spo2 < 90 || t.hr > 140;
  const acuityLabel = deteriorating ? "P1 · Deteriorating" : "P1 · Critical";

  return (
    <div className="border-t border-hairline bg-gradient-to-b from-[oklch(0.16_0.02_240)] to-[oklch(0.13_0.02_240)]">
      {/* Live A→B rail — vehicle dashboard feel with milestone ticks */}
      <ProgressRail progress={t.progress} arrived={arrived} />

      {/* ============ INSTRUMENT CLUSTER ============ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-hairline">
        <Gauge360
          label="Speed"
          unit="km/h"
          value={Math.round(t.speedKmh)}
          max={120}
          color={arrived ? BRAND.teal : BRAND.blue}
          icon={<Wind className="size-3" />}
        />
        <EtaCluster
          remainSec={remainSec}
          progress={t.progress}
          distLeftKm={distLeftKm}
          arrived={arrived}
        />
        <VitalsCluster
          hr={t.hr}
          spo2={t.spo2}
          bpSys={t.bpSys}
          bpDia={t.bpDia}
          gcs={t.gcs}
          deteriorating={deteriorating}
        />
        <NextCallCluster
          secs={nextRespondSec}
          armed={nearArrival || arrived}
        />
      </div>

      {/* ============ DETAIL STRIP ============ */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-t border-hairline">
        <DetailColumn
          title="Movement"
          icon={<Navigation className="size-3.5" />}
          accent={BRAND.blue}
          rows={[
            ["Heading", "NNE · 014°"],
            ["Trip time", fmtHHMM(t.elapsedSec)],
            ["A → B", `${Math.round(t.progress * 100)}% · ${distLeftKm.toFixed(1)} km left`],
            ["Route", "Primary · King Fahd Rd"],
          ]}
          chips={[
            { label: "Lights · Siren", tone: "coral" },
            { label: "Lane assist", tone: "teal" },
            { label: "5 Hz GPS", tone: "mute" },
          ]}
        />
        <DetailColumn
          title="Patient onboard"
          icon={<Heart className="size-3.5" />}
          accent={BRAND.coral}
          rows={[
            ["Case", "C-2041 · Al Khobar"],
            ["Acuity", acuityLabel],
            ["Disposition", arrived ? "Handoff in progress" : nearArrival ? "Trauma bay 2 · doors opening" : "Pre-alert sent · bay 2 reserved"],
            ["Care path", "ALS · IV access · 12-lead pushed"],
          ]}
          chips={[
            { label: "Internal bleed (susp.)", tone: "coral" },
            { label: "O₂ 6 L/min", tone: "blue" },
            { label: "Saline 500 mL", tone: "teal" },
          ]}
        />
        <DetailColumn
          title="Next request"
          icon={<Zap className="size-3.5" />}
          accent={BRAND.teal}
          rows={[
            ["Case", "C-2039 · Transfer"],
            ["Pickup", "Dammam Medical Tower"],
            ["Destination", "King Fahd Specialist"],
            ["Status", nearArrival || arrived ? "Crew armed · auto-accept in 60s" : "Queued · auto-assign on handoff"],
          ]}
          chips={[
            { label: "ETA ~14 min", tone: "blue" },
            { label: "Cardiology", tone: "teal" },
            { label: "Sedated", tone: "mute" },
          ]}
        />
      </div>
    </div>
  );
}

/* ---------- Instrument cluster primitives ---------- */

function ProgressRail({ progress, arrived }: { progress: number; arrived: boolean }) {
  const pct = Math.max(0, Math.min(1, progress));
  const color = arrived ? BRAND.teal : BRAND.blue;
  return (
    <div className="relative h-1.5 bg-[oklch(0.18_0.02_240)] overflow-hidden">
      {/* milestone ticks */}
      {[0.25, 0.5, 0.75].map((m) => (
        <span key={m} className="absolute top-0 bottom-0 w-px bg-white/10" style={{ left: `${m * 100}%` }} />
      ))}
      <div
        className="absolute inset-y-0 left-0 transition-[width] duration-150"
        style={{
          width: `${(pct * 100).toFixed(2)}%`,
          background: `linear-gradient(90deg, ${BRAND.blueDeep}, ${color})`,
          boxShadow: `0 0 14px ${color}80`,
        }}
      />
      <span
        className="absolute top-1/2 -translate-y-1/2 size-2.5 rounded-full border-2"
        style={{
          left: `calc(${(pct * 100).toFixed(2)}% - 5px)`,
          background: color,
          borderColor: "#fff",
          boxShadow: `0 0 12px ${color}`,
        }}
      />
    </div>
  );
}

function ClusterShell({ children, label, live = true }: { children: React.ReactNode; label: string; live?: boolean }) {
  return (
    <div className="bg-panel p-4 relative">
      <div className="mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-1.5">
        {label}
        {live && (
          <span className="ml-auto inline-flex items-center gap-1 text-teal">
            <span className="size-1 rounded-full bg-teal animate-pulse" /> LIVE
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Gauge360({ label, unit, value, max, color, icon }: { label: string; unit: string; value: number; max: number; color: string; icon?: React.ReactNode }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const R = 34;
  const C = 2 * Math.PI * R;
  // 270° arc starting at 135°
  const arc = C * 0.75;
  const filled = arc * pct;
  return (
    <ClusterShell label={label}>
      <div className="mt-2 grid place-items-center">
        <div className="relative size-[110px]">
          <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-[135deg]">
            <circle cx="40" cy="40" r={R} fill="none" stroke="oklch(0.22 0.02 240)" strokeWidth="6" strokeDasharray={`${arc} ${C}`} strokeLinecap="round" />
            <circle cx="40" cy="40" r={R} fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${filled} ${C}`} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color}90)`, transition: "stroke-dasharray 200ms linear" }} />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="mono text-[9px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 justify-center">{icon}{unit}</div>
              <div className="font-serif text-3xl tabular-nums leading-none mt-0.5" style={{ color }}>{value}</div>
            </div>
          </div>
        </div>
      </div>
    </ClusterShell>
  );
}

function EtaCluster({ remainSec, progress, distLeftKm, arrived }: { remainSec: number; progress: number; distLeftKm: number; arrived: boolean }) {
  const pct = Math.max(0, Math.min(1, progress));
  const R = 34, C = 2 * Math.PI * R;
  const filled = C * pct;
  const color = arrived ? BRAND.teal : BRAND.blueDeep;
  return (
    <ClusterShell label="ETA · Al Mana General">
      <div className="mt-2 grid place-items-center">
        <div className="relative size-[110px]">
          <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
            <circle cx="40" cy="40" r={R} fill="none" stroke="oklch(0.22 0.02 240)" strokeWidth="6" />
            <circle cx="40" cy="40" r={R} fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${filled} ${C}`} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${color}90)`, transition: "stroke-dasharray 200ms linear" }} />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="mono text-[9px] uppercase tracking-widest text-muted-foreground">{arrived ? "Status" : "Arriving in"}</div>
              <div className="font-serif text-3xl tabular-nums leading-none mt-0.5" style={{ color }}>
                {arrived ? "✓" : fmtMinSec(remainSec)}
              </div>
              <div className="mono text-[10px] text-muted-foreground mt-1 tabular-nums">{distLeftKm.toFixed(1)} km · {Math.round(pct * 100)}%</div>
            </div>
          </div>
        </div>
      </div>
    </ClusterShell>
  );
}

function VitalsCluster({ hr, spo2, bpSys, bpDia, gcs, deteriorating }: { hr: number; spo2: number; bpSys: number; bpDia: number; gcs: number; deteriorating: boolean }) {
  const color = deteriorating ? BRAND.coral : BRAND.teal;
  return (
    <ClusterShell label="Patient vitals">
      <div className="mt-2">
        <EcgStrip hr={hr} color={BRAND.coral} />
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2">
          <VitalBox label="HR" value={hr} unit="bpm" color={BRAND.coral} alarm={hr > 140} />
          <VitalBox label="SpO₂" value={spo2} unit="%" color={spo2 < 90 ? BRAND.coral : BRAND.teal} alarm={spo2 < 90} />
          <VitalBox label="BP" value={`${bpSys}/${bpDia}`} unit="mmHg" color={BRAND.blue} />
          <VitalBox label="GCS" value={gcs} unit="/15" color={BRAND.amber} />
        </div>
        <div className="mono text-[9px] uppercase tracking-widest mt-2 px-2 py-1 rounded inline-flex items-center gap-1.5"
          style={{ background: `${color}22`, color }}>
          <span className="size-1.5 rounded-full animate-pulse" style={{ background: color }} />
          {deteriorating ? "Deteriorating" : "Stable on transport"}
        </div>
      </div>
    </ClusterShell>
  );
}

function VitalBox({ label, value, unit, color, alarm = false }: { label: string; value: number | string; unit: string; color: string; alarm?: boolean }) {
  return (
    <div className={`relative rounded border border-hairline px-2 py-1 ${alarm ? "animate-pulse" : ""}`} style={{ background: "oklch(0.14 0.02 240)" }}>
      <div className="mono text-[8px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mono tabular-nums text-sm font-bold leading-tight" style={{ color }}>{value}<span className="text-[9px] text-muted-foreground font-normal ml-0.5">{unit}</span></div>
    </div>
  );
}

/** Tiny live ECG strip — synthetic QRS that scrolls right-to-left at the
 *  current heart rate. SVG path animated via stroke-dashoffset. */
function EcgStrip({ hr, color }: { hr: number; color: string }) {
  const [, force] = useState(0);
  const tRef = useRef(performance.now());
  useEffect(() => {
    let raf = 0;
    const loop = () => { force((n) => (n + 1) & 0xffff); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  // beats per second
  const bps = Math.max(0.5, hr / 60);
  const W = 220, H = 36;
  const beats = 4;
  const beatW = W / beats;
  // phase advances with time → wave scrolls
  const phase = ((performance.now() - tRef.current) / 1000 * bps) % 1;
  const offset = -phase * beatW;
  // single QRS template path
  const qrs = (x0: number) => {
    const x = (dx: number) => (x0 + dx).toFixed(1);
    const mid = H / 2;
    return `M ${x(0)} ${mid} L ${x(beatW * 0.25)} ${mid} L ${x(beatW * 0.30)} ${mid - 2} L ${x(beatW * 0.34)} ${mid + 4} L ${x(beatW * 0.36)} ${mid - 14} L ${x(beatW * 0.40)} ${mid + 10} L ${x(beatW * 0.44)} ${mid + 1} L ${x(beatW * 0.55)} ${mid} L ${x(beatW * 0.62)} ${mid - 3} L ${x(beatW * 0.70)} ${mid} L ${x(beatW)} ${mid}`;
  };
  const d = Array.from({ length: beats + 2 }, (_, i) => qrs(beatW * i + offset)).join(" ");
  return (
    <div className="relative h-9 rounded overflow-hidden border border-hairline" style={{ background: "oklch(0.10 0.02 240)" }}>
      {/* grid */}
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
        backgroundSize: "12px 12px",
      }} />
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${color}b0)` }} />
      </svg>
      <div className="absolute left-1.5 top-1 mono text-[8px] uppercase tracking-widest text-muted-foreground">ECG · II</div>
      <div className="absolute right-1.5 bottom-0.5 mono text-[8px] uppercase tracking-widest" style={{ color }}>{hr} bpm</div>
    </div>
  );
}

function NextCallCluster({ secs, armed }: { secs: number; armed: boolean }) {
  const max = 15 * 60;
  const pct = Math.max(0, Math.min(1, 1 - secs / max));
  const color = armed ? BRAND.teal : BRAND.amber;
  const R = 34, C = 2 * Math.PI * R;
  const filled = C * pct;
  return (
    <ClusterShell label="Next request">
      <div className="mt-2 grid place-items-center">
        <div className="relative size-[110px]">
          <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
            <circle cx="40" cy="40" r={R} fill="none" stroke="oklch(0.22 0.02 240)" strokeWidth="6" />
            <circle cx="40" cy="40" r={R} fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${filled} ${C}`} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color}90)`, transition: "stroke-dasharray 300ms linear" }} />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="mono text-[9px] uppercase tracking-widest text-muted-foreground flex items-center gap-1 justify-center">
                <Siren className="size-3" /> C-2039
              </div>
              <div className="font-serif text-3xl tabular-nums leading-none mt-0.5" style={{ color }}>
                {fmtMinSec(secs)}
              </div>
              <div className="mono text-[10px] text-muted-foreground mt-1">{armed ? "Crew armed" : "Auto-queue"}</div>
            </div>
          </div>
        </div>
      </div>
    </ClusterShell>
  );
}

function DetailColumn({ title, icon, accent, rows, chips }: {
  title: string;
  icon: React.ReactNode;
  accent: string;
  rows: [string, string][];
  chips?: { label: string; tone: "teal" | "coral" | "blue" | "mute" }[];
}) {
  const toneStyle = (tone: "teal" | "coral" | "blue" | "mute") => {
    switch (tone) {
      case "teal":  return { background: `${BRAND.teal}1f`,  color: BRAND.teal,  borderColor: `${BRAND.teal}55` };
      case "coral": return { background: `${BRAND.coral}1f`, color: BRAND.coral, borderColor: `${BRAND.coral}55` };
      case "blue":  return { background: `${BRAND.blue}1f`,  color: BRAND.blue,  borderColor: `${BRAND.blue}55` };
      default:      return { background: "oklch(0.20 0.02 240)", color: "var(--color-muted-foreground)", borderColor: "var(--color-hairline)" };
    }
  };
  return (
    <div className="p-4 border-r border-hairline last:border-r-0 relative">
      <span className="absolute left-0 top-4 bottom-4 w-px" style={{ background: accent, opacity: 0.7 }} />
      <div className="mono text-[10px] uppercase tracking-widest flex items-center gap-1.5" style={{ color: accent }}>
        {icon}{title}
      </div>
      <dl className="mt-3 space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 tabular-nums">
            <dt className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</dt>
            <dd className="mono text-xs font-semibold text-foreground text-right">{v}</dd>
          </div>
        ))}
      </dl>
      {chips && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c.label} className="mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border" style={toneStyle(c.tone)}>{c.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Fallback satellite-style panels (used when Google Maps fails
   to load — invalid key, billing not enabled, referrer block).
   These mirror the real layout so the hero still feels alive.
   ============================================================ */

const SAT_BG: React.CSSProperties = {
  backgroundColor: "#0A1118",
  backgroundImage:
    // jeweler-grade satellite mirror: vignette glow + faint city blooms
    // + ultra-fine grid that reads like a survey overlay
    "radial-gradient(55% 45% at 22% 28%, rgba(40,214,182,0.10), transparent 65%)," +
    "radial-gradient(45% 35% at 78% 68%, rgba(79,182,247,0.10), transparent 65%)," +
    "radial-gradient(35% 30% at 58% 22%, rgba(255,110,91,0.06), transparent 65%)," +
    "radial-gradient(120% 80% at 50% 55%, transparent 55%, rgba(0,0,0,0.55) 100%)," +
    "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)," +
    "linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
  backgroundSize: "auto, auto, auto, auto, 28px 28px, 28px 28px",
};

function FallbackChrome({ children }: { children?: React.ReactNode }) {
  return (
    <div className="absolute inset-0" style={SAT_BG}>
      {/* faint compass meridian */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.07]"
        style={{ background:
          "linear-gradient(115deg, transparent 49.7%, rgba(255,255,255,0.7) 50%, transparent 50.3%)" }} />
      {children}
      {/* Offline footer — hidden on mobile to avoid telemetry-card overlap */}
      <div className="hidden sm:block absolute bottom-1.5 right-2.5 mono text-[9px] uppercase tracking-[0.25em] text-white/35 pointer-events-none z-[5]">
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

function TeamFallback() {
  const tel = useTelemetry();
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
  // Read live progress from the shared telemetry store so values update.
  const pct = Math.max(0, Math.min(1, tel.progress || 0));
  const arrived = pct >= 0.999;
  const remainSec = Math.max(0, tel.totalSec * (1 - pct));
  const etaStr = arrived ? "Arrived" : fmtMinSec(remainSec);
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
      {/* Iconic Google-Maps style road network underneath the trip */}
      <svg viewBox="0 0 400 250" className="absolute inset-0 w-full h-full pointer-events-none z-[10]" preserveAspectRatio="none">
        <defs>
          <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
          <linearGradient id="routeGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#1F6FEB" />
            <stop offset="100%" stopColor="#4FB6F7" />
          </linearGradient>
          {/* soft contact shadow for the destination pin */}
          <filter id="pinShadow" x="-60%" y="-40%" width="220%" height="200%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>
        {/* arterial roads (warm beige like Maps) */}
        <g stroke="#2a3340" strokeLinecap="round" fill="none">
          <path d="M -10 215 L 410 175" strokeWidth="10" />
          <path d="M 90 260 L 130 -10" strokeWidth="9" />
          <path d="M 250 260 L 290 -10" strokeWidth="8" />
          <path d="M -10 110 L 410 90"  strokeWidth="8" />
        </g>
        <g stroke="#3a4555" strokeLinecap="round" fill="none" strokeWidth="1.2">
          <path d="M -10 215 L 410 175" />
          <path d="M 90 260 L 130 -10" />
          <path d="M 250 260 L 290 -10" />
          <path d="M -10 110 L 410 90" />
        </g>
        {/* alternates — thin grey ghost routes */}
        <path d="M 60 200 C 140 180, 200 100, 340 70" stroke="#94a3b8" strokeOpacity="0.35" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M 60 200 C 120 220, 260 200, 340 70" stroke="#94a3b8" strokeOpacity="0.28" strokeWidth="5" fill="none" strokeLinecap="round" />
        {/* PRIMARY ROUTE — dotted line per direction (Google Maps walking style) */}
        {/* soft glow casing */}
        <path d="M 60 200 C 160 200, 220 130, 340 70" stroke="url(#routeGrad)" strokeOpacity="0.35"
          strokeWidth="14" fill="none" strokeLinecap="round" filter="url(#routeGlow)" />
        {/* remaining route — light brand blue dotted */}
        <path d="M 60 200 C 160 200, 220 130, 340 70"
          stroke="#4FB6F7" strokeWidth="5.5" fill="none"
          strokeLinecap="round" strokeDasharray="0.1 5" />
        {/* travelled route — deep brand blue solid dots, advancing */}
        <path d="M 60 200 C 160 200, 220 130, 340 70"
          stroke="#1F6FEB" strokeWidth="6" fill="none"
          strokeLinecap="round" pathLength={1}
          strokeDasharray={`${pct} 1`} />
        {/* origin */}
        <g>
          <circle cx="60" cy="200" r="11" fill="#0A1118" stroke="#ffffff" strokeWidth="2.5" />
          <circle cx="60" cy="200" r="4.5" fill="#4FB6F7" />
        </g>
        {/* destination teardrop — compact, jeweler-grade */}
        <g transform="translate(340 70)">
          {/* diffuse drop shadow under the pin (filter-based, no harsh ellipse) */}
          <path d="M 0 -14 C -6 -14, -10.5 -9.5, -10.5 -3.5 C -10.5 3.5, 0 12, 0 12 S 10.5 3.5, 10.5 -3.5 C 10.5 -9.5, 6 -14, 0 -14 Z"
            fill="#000" opacity="0.45" filter="url(#pinShadow)" transform="translate(0.6 1.4)" />
          {/* pin body — slightly tighter silhouette, jeweler stroke */}
          <path d="M 0 -14 C -6 -14, -10.5 -9.5, -10.5 -3.5 C -10.5 3.5, 0 12, 0 12 S 10.5 3.5, 10.5 -3.5 C 10.5 -9.5, 6 -14, 0 -14 Z"
            fill="#FF6E5B" stroke="#ffffff" strokeWidth="0.9" />
          {/* subtle inner gradient highlight for depth */}
          <path d="M 0 -12.6 C -4.4 -12.6, -8 -9.2, -8.4 -4.6"
            stroke="#ffffff" strokeOpacity="0.6" strokeWidth="0.7" fill="none" strokeLinecap="round" />
          {/* white disc with hairline ring */}
          <circle cx="0" cy="-4.5" r="3.7" fill="#ffffff" />
          <circle cx="0" cy="-4.5" r="3.7" fill="none" stroke="#FF6E5B" strokeOpacity="0.25" strokeWidth="0.4" />
          {/* medical cross — perfectly centered, tighter proportions */}
          <rect x="-0.55" y="-6.6" width="1.1" height="4.2" rx="0.25" fill="#FF6E5B"/>
          <rect x="-2.1"  y="-5.05" width="4.2" height="1.1" rx="0.25" fill="#FF6E5B"/>
        </g>
        {/* ambulance — positioned by progress so it can sit at destination */}
        <g transform={`translate(${p1.x} ${p1.y})`}>
          <circle r="14" fill="#28D6B6" fillOpacity="0.25">
            <animate attributeName="r" values="11;15;11" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="fill-opacity" values="0.35;0.05;0.35" dur="1.6s" repeatCount="indefinite" />
          </circle>
          <g transform={`rotate(${angle.toFixed(1)})`}>
            <rect x="-8" y="-12" width="16" height="24" rx="3" fill="#ffffff" stroke="#0f172a" strokeWidth="1.2" />
            <path d="M -7 -8 Q 0 -11 7 -8 L 6 -6 L -6 -6 Z" fill="#4FB6F7" stroke="#0f172a" strokeWidth="0.5" />
            <rect x="-8" y="-2" width="16" height="2" fill="#FF6E5B" />
            <rect x="-1" y="1" width="2" height="8" fill="#FF6E5B" />
            <rect x="-4.5" y="4" width="9" height="2" fill="#FF6E5B" />
            <rect x="-6.5" y="-11" width="5" height="1.6" rx="0.4" fill="#FF6E5B" />
            <rect x="1.5" y="-11" width="5" height="1.6" rx="0.4" fill="#28D6B6" />
          </g>
        </g>
      </svg>

      {/* Iconic Google Maps landmarks — road labels + POIs */}
      <div className="absolute pointer-events-none z-[15] mono text-[9px] tracking-[0.18em] uppercase text-white/45"
        style={{ top: "70%", left: "8%", transform: "rotate(-6deg)" }}>
        King Fahd Rd
      </div>
      <div className="absolute pointer-events-none z-[15] mono text-[9px] tracking-[0.18em] uppercase text-white/40"
        style={{ top: "38%", left: "62%", transform: "rotate(86deg)" }}>
        Prince Sultan
      </div>
      <div className="absolute pointer-events-none z-[15] flex items-center gap-1.5"
        style={{ top: "20%", left: "18%" }}>
        <span className="size-1.5 rounded-[2px] bg-emerald-400/80" />
        <span className="mono text-[9px] uppercase tracking-widest text-emerald-200/70">Al Bandariyah Park</span>
      </div>
      <div className="absolute pointer-events-none z-[15] flex items-center gap-1.5"
        style={{ top: "80%", left: "55%" }}>
        <span className="size-1.5 rounded-full bg-sky-300/80" />
        <span className="mono text-[9px] uppercase tracking-widest text-sky-200/70">Half-Moon Bay</span>
      </div>
      <div className="absolute pointer-events-none z-[15] flex items-center gap-1.5"
        style={{ top: "55%", left: "33%" }}>
        <span className="size-1.5 rotate-45 bg-white/70" />
        <span className="mono text-[9px] uppercase tracking-widest text-white/55">Al Thuqbah · Origin</span>
      </div>

      {/* Destination ETA bubble (above the pin) */}
      <div data-debug-id="offline-dest-eta-bubble" className="absolute -translate-x-1/2 -translate-y-full pointer-events-none z-[30]"
        style={{ top: "calc(10% - 18px)", left: "min(78%, calc(100% - 56px))" }}>
        <div className="rounded-full p-[1px] bg-gradient-to-br from-white/80 to-white/20 shadow-[0_6px_20px_-6px_rgba(31,111,235,0.38)]">
          <div
            className="px-2.5 py-[4px] rounded-full text-[10px] font-semibold flex items-center gap-1 backdrop-blur-md"
            style={{
              background: arrived ? "rgba(40,214,182,0.76)" : "rgba(31,111,235,0.76)",
              color: arrived ? "#080B11" : "#fff",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <Clock className="size-2.5 opacity-80" /> {etaStr}
            <span className="inline-block size-1 rounded-full" style={{ background: arrived ? "#080B11" : "#28D6B6" }} />
          </div>
        </div>
      </div>

      {/* Alternate route ETA pill */}
      <div data-debug-id="offline-alt-eta-pill" className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[25]"
        style={{ top: "32%", left: "42%" }}>
        <div className="rounded-full p-[1px] bg-gradient-to-br from-white/75 to-white/20 shadow-[0_6px_20px_-6px_rgba(79,182,247,0.35)]">
          <div className="rounded-full px-2.5 py-1 bg-white/25 backdrop-blur-xl text-slate-900 text-[11px] font-semibold flex items-center gap-1.5"
            style={{ fontVariantNumeric: "tabular-nums", textShadow: "0 1px 1px rgba(255,255,255,0.6)" }}>
            7 min <span className="text-slate-500 font-normal">· alt</span>
          </div>
        </div>
      </div>

      {/* Bottom-left ETA card — elite glass telemetry */}
      <div
        data-debug-id="offline-eta-card"
        className="absolute bottom-3 left-3 right-16 sm:right-auto sm:w-[320px] z-[40] rounded-[22px] p-[1px] bg-gradient-to-br from-white/75 via-white/30 to-white/10"
        style={{
          boxShadow: arrived
            ? "0 14px 44px -12px rgba(40,214,182,0.34)"
            : "0 14px 44px -12px rgba(31,111,235,0.30)",
        }}
      >
        <div className="relative rounded-[21px] bg-white/30 backdrop-blur-2xl overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-white/25 via-white/10 to-transparent" />
          <div className="relative px-4 pt-3 pb-3">
            <div className="flex items-start justify-between">
              <div style={{ textShadow: "0 1px 1px rgba(255,255,255,0.65)" }}>
                <div className="mono text-[9px] font-bold tracking-[0.22em] uppercase text-slate-500/90 leading-none mb-1">
                  ETA · Al Mana
                </div>
                <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-tight leading-tight">
                  General Hospital
                </div>
              </div>
              <div className="flex items-center gap-1 text-slate-500" style={{ textShadow: "0 1px 1px rgba(255,255,255,0.65)" }}>
                <Clock className="size-3" />
                <span className="mono text-[11px] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(pct * 100)}%
                </span>
              </div>
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div
                className="text-[34px] font-bold tracking-tighter leading-none"
                style={{ color: arrived ? "#0F7F66" : "#1F6FEB", fontVariantNumeric: "tabular-nums", textShadow: "0 1px 1px rgba(255,255,255,0.65)" }}
              >
                {arrived ? "0:00" : etaStr}
              </div>
              <div
                className="text-right mono text-[10px] text-slate-500 leading-tight"
                style={{ fontVariantNumeric: "tabular-nums", textShadow: "0 1px 1px rgba(255,255,255,0.65)" }}
              >
                <div>{Math.max(0, tel.totalKm * (1 - pct)).toFixed(2)} km left</div>
                <div className="mt-0.5">{Math.round(tel.speedKmh)} km/h</div>
              </div>
            </div>
          </div>
          <div className="relative h-[3px] w-full bg-white/20">
            <div
              className="absolute inset-y-0 left-0 transition-[width] duration-300"
              style={{
                width: `${Math.round(pct * 100)}%`,
                background: arrived
                  ? "linear-gradient(90deg, #28D6B6, #4FB6F7)"
                  : "linear-gradient(90deg, #4FB6F7, #1F6FEB)",
                boxShadow: arrived
                  ? "0 0 14px rgba(40,214,182,0.5)"
                  : "0 0 14px rgba(79,182,247,0.5)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Compass FAB */}
      <div className="absolute bottom-3 right-3 z-[45]">
        <button aria-label="Recenter map"
          className="size-10 rounded-full bg-white/95 backdrop-blur shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] border border-white/40 grid place-items-center text-slate-700 hover:scale-105 active:scale-95 transition-transform">
          <Compass className="size-5" />
        </button>
      </div>

      {/* Crew tag — desktop only (mobile telemetry card spans the width) */}
      <div className="hidden sm:flex absolute bottom-4 right-16 z-[35] pointer-events-none mono text-[9px] uppercase tracking-[0.25em] text-white/55 items-center gap-1.5">
        <Radio className="size-3 text-teal" /> Crew 04 · A → B
      </div>
    </FallbackChrome>
  );
}
