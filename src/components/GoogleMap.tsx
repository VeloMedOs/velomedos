import { useEffect, useRef } from "react";
import type { MapMarker, MapPolyline } from "./LeafletMap";

declare global {
  interface Window {
    google?: typeof google;
    __velomedMapsCallback?: () => void;
    __velomedMapsLoading?: Promise<void>;
  }
}

const variantColor: Record<NonNullable<MapMarker["variant"]>, string> = {
  ambulance: "#3b9eff",
  incident: "#ef4444",
  patient: "#22c55e",
  clinic: "#f59e0b",
  paramedic: "#06b6d4",
  doctor: "#a855f7",
};

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__velomedMapsLoading) return window.__velomedMapsLoading;
  const key = (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ?? "";
  const ch = (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined) ?? "";
  window.__velomedMapsLoading = new Promise<void>((resolve, reject) => {
    window.__velomedMapsCallback = () => resolve();
    const s = document.createElement("script");
    s.async = true;
    s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=__velomedMapsCallback${ch ? `&channel=${encodeURIComponent(ch)}` : ""}`;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return window.__velomedMapsLoading;
}

function svgPin(color: string, glyph: string, pulse: boolean): string {
  const ring = pulse ? `<circle cx="22" cy="22" r="18" fill="${color}" fill-opacity="0.18"><animate attributeName="r" values="14;22;14" dur="1.6s" repeatCount="indefinite"/><animate attributeName="fill-opacity" values="0.35;0.05;0.35" dur="1.6s" repeatCount="indefinite"/></circle>` : "";
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">${ring}<circle cx="22" cy="22" r="11" fill="${color}" stroke="#0b1220" stroke-width="2"/><text x="22" y="26" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="13" font-weight="700" fill="#0b1220">${glyph}</text></svg>`)}`;
}

function glyphFor(v?: MapMarker["variant"]): string {
  switch (v) {
    case "incident": return "!";
    case "clinic": return "+";
    case "patient": return "•";
    case "paramedic": return "P";
    case "doctor": return "D";
    default: return "▲";
  }
}

export function GoogleMap({
  center = [40.758, -73.985],
  zoom = 12,
  markers = [],
  polylines = [],
  className = "h-full w-full",
  onMapClick,
  fitToMarkers = false,
}: {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  polylines?: MapPolyline[];
  className?: string;
  onMapClick?: (lat: number, lng: number) => void;
  fitToMarkers?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const linesRef = useRef<Map<string, google.maps.Polyline>>(new Map());
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;

  useEffect(() => {
    let cancelled = false;
    loadMaps().then(() => {
      if (cancelled || !ref.current || mapRef.current) return;
      const map = new google.maps.Map(ref.current, {
        center: { lat: center[0], lng: center[1] },
        zoom,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
          { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#334155" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#020617" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
      });
      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (e.latLng && clickRef.current) clickRef.current(e.latLng.lat(), e.latLng.lng());
      });
      mapRef.current = map;
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;
    const seen = new Set<string>();
    for (const m of markers) {
      seen.add(m.id);
      const color = variantColor[m.variant ?? "ambulance"];
      const icon = {
        url: svgPin(color, glyphFor(m.variant), !!m.pulse),
        scaledSize: new google.maps.Size(44, 44),
        anchor: new google.maps.Point(22, 22),
      };
      const existing = markersRef.current.get(m.id);
      const pos = new google.maps.LatLng(m.lat, m.lng);
      if (existing) {
        // smooth interpolation
        const start = existing.getPosition();
        if (start) {
          const startTs = performance.now();
          const dur = 800;
          const sLat = start.lat(), sLng = start.lng();
          const animate = (t: number) => {
            const k = Math.min(1, (t - startTs) / dur);
            existing.setPosition(new google.maps.LatLng(sLat + (m.lat - sLat) * k, sLng + (m.lng - sLng) * k));
            if (k < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        } else {
          existing.setPosition(pos);
        }
        existing.setIcon(icon);
        existing.setTitle(m.label ?? "");
      } else {
        const mk = new google.maps.Marker({ map, position: pos, icon, title: m.label ?? "" });
        markersRef.current.set(m.id, mk);
      }
    }
    for (const [id, mk] of markersRef.current.entries()) {
      if (!seen.has(id)) { mk.setMap(null); markersRef.current.delete(id); }
    }
    if (fitToMarkers && markers.length > 0) {
      const b = new google.maps.LatLngBounds();
      for (const m of markers) b.extend({ lat: m.lat, lng: m.lng });
      map.fitBounds(b, 64);
    }
  }, [markers, fitToMarkers]);

  // polylines
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;
    const seen = new Set<string>();
    for (const p of polylines) {
      seen.add(p.id);
      const existing = linesRef.current.get(p.id);
      const path = p.path.map((pt) => new google.maps.LatLng(pt.lat, pt.lng));
      if (existing) {
        existing.setPath(path);
      } else {
        const line = new google.maps.Polyline({
          map, path,
          strokeColor: p.color ?? "#3b9eff",
          strokeOpacity: 0.85,
          strokeWeight: p.width ?? 4,
        });
        linesRef.current.set(p.id, line);
      }
    }
    for (const [id, l] of linesRef.current.entries()) {
      if (!seen.has(id)) { l.setMap(null); linesRef.current.delete(id); }
    }
  }, [polylines]);

  return <div ref={ref} className={className} />;
}