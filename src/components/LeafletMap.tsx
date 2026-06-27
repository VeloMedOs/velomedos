import { useEffect, useRef } from "react";
import L from "leaflet";
import { MARKER_COLOR } from "@/lib/brand";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  variant?: "ambulance" | "incident" | "patient" | "clinic" | "paramedic" | "doctor";
  status?: string;
  pulse?: boolean;
  speedKmh?: number;
};

export type MapPolyline = {
  id: string;
  path: { lat: number; lng: number }[];
  color?: string;
  width?: number;
};

const variantColor: Record<NonNullable<MapMarker["variant"]>, string> = {
  ambulance: MARKER_COLOR.ambulance,
  incident:  MARKER_COLOR.incident,
  patient:   MARKER_COLOR.patient,
  clinic:    MARKER_COLOR.clinic,
  paramedic: MARKER_COLOR.paramedic,
  doctor:    MARKER_COLOR.doctor,
};

function iconFor(m: MapMarker): L.DivIcon {
  const color = variantColor[m.variant ?? "ambulance"];
  const inner = m.variant === "incident" ? "!" : m.variant === "clinic" ? "+" : m.variant === "patient" ? "•" : "▲";
  const pulseRing = m.pulse
    ? `<span style="position:absolute;inset:-6px;border-radius:9999px;border:2px solid ${color};opacity:0.5;animation:pulse-emergency 1.6s infinite"></span>`
    : "";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:22px;height:22px;display:grid;place-items:center;border-radius:9999px;background:${color};color:#0f172a;font:600 12px/1 'JetBrains Mono',monospace;box-shadow:0 0 12px ${color}66, 0 2px 6px rgba(0,0,0,0.4)">${pulseRing}${inner}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export function LeafletMap({
  center = [40.758, -73.985],
  zoom = 12,
  markers = [],
  className = "h-full w-full",
  onMapClick,
}: {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  className?: string;
  onMapClick?: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    if (onMapClick) {
      map.on("click", (e) => onMapClick(e.latlng.lat, e.latlng.lng));
    }
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const m of markers) {
      const marker = L.marker([m.lat, m.lng], { icon: iconFor(m) });
      if (m.label) marker.bindTooltip(m.label, { direction: "top", offset: [0, -8], className: "velomed-tip" });
      marker.addTo(layer);
    }
  }, [markers]);

  return <div ref={containerRef} className={className} />;
}