/** Decode an encoded Google polyline string into lat/lng points. */
export function decodePolyline(str: string, precision = 5): { lat: number; lng: number }[] {
  let index = 0, lat = 0, lng = 0;
  const factor = Math.pow(10, precision);
  const coords: { lat: number; lng: number }[] = [];
  while (index < str.length) {
    let b: number, shift = 0, result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;
    shift = 0; result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;
    coords.push({ lat: lat / factor, lng: lng / factor });
  }
  return coords;
}

/** Encode an array of lat/lng points into a Google polyline string. */
export function encodePolyline(coords: { lat: number; lng: number }[], precision = 5): string {
  const factor = Math.pow(10, precision);
  let out = "", prevLat = 0, prevLng = 0;
  const enc = (v: number) => {
    v = v < 0 ? ~(v << 1) : v << 1;
    let s = "";
    while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
    return s + String.fromCharCode(v + 63);
  };
  for (const c of coords) {
    const lat = Math.round(c.lat * factor), lng = Math.round(c.lng * factor);
    out += enc(lat - prevLat) + enc(lng - prevLng);
    prevLat = lat; prevLng = lng;
  }
  return out;
}