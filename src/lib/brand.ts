/**
 * VeloMed OS brand palette — single source of truth for every map overlay,
 * pin, route polyline, halo, and accent across the app. Aligned with the
 * brand book (Teal #28D6B6 · Blue #4FB6F7 · Coral #FF6E5B).
 */
export const BRAND = {
  teal:      "#28D6B6",
  tealDeep:  "#0F8F77",
  tealSoft:  "rgba(40,214,182,0.18)",
  blue:      "#4FB6F7",
  blueDeep:  "#1F6FEB",
  blueSoft:  "#BCDCFB",
  coral:     "#FF6E5B",
  coralDeep: "#D94A38",
  amber:     "#F5B544",
  ink:       "#080B11",
  inkSoft:   "#1A2230",
  paper:     "#EAF0F7",
} as const;

/** Marker variant → brand color (used by GoogleMap + LeafletMap). */
export const MARKER_COLOR = {
  ambulance: BRAND.blue,       // moving asset
  incident:  BRAND.coral,      // emergency
  patient:   BRAND.teal,       // person in care
  clinic:    BRAND.amber,      // facility
  paramedic: BRAND.blueDeep,   // crew (medic)
  doctor:    BRAND.coralDeep,  // physician
} as const;

/** Default route polyline color (brand blue, Google-route weight). */
export const ROUTE_COLOR = BRAND.blue;
/** Travelled segment color (deeper blue, drawn above the remaining path). */
export const ROUTE_TRAVELLED_COLOR = BRAND.blueDeep;
/** Faded alternate routes. */
export const ROUTE_ALT_COLOR = BRAND.blueSoft;