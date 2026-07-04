import { LogManager, TransformRequestManager } from "@maplibre/maplibre-react-native";

// MapTiler vector basemap. We use a *custom* style published in MapTiler's
// Customize editor (a clone of "Outdoor" / outdoor-v4 with the marked
// hiking-route relation layers hidden, keeping contours, hillshade and
// footpaths) so the app's own trail overlays are the only routes drawn. Both
// the key and the custom style id are read from EXPO_PUBLIC_* env vars, the
// same mechanism as BASE_URL in api-config — never hard-coded.
const MAPTILER_API_KEY = process.env.EXPO_PUBLIC_MAPTILER_API_KEY;
const MAPTILER_STYLE_ID = process.env.EXPO_PUBLIC_MAPTILER_STYLE_ID;

// The restricted key in MapTiler Cloud has an "Allowed user-agent header"
// filter set to "stigvidd". MapTiler rejects any request whose User-Agent
// doesn't contain this value (case-sensitive), leaving the map blank, so this
// constant must stay in sync with the dashboard value. We send exactly
// "stigvidd" to match it 1:1.
const MAP_USER_AGENT = "stigvidd";

// The key is baked into the style URL. It already ships in the JS bundle via
// the EXPO_PUBLIC_* mechanism, so keeping it out of the URL buys no real
// security — the protection is the User-Agent restriction plus the monthly
// spending limit on the key. Baking it in also avoids a duplicate `?key=`
// param that injecting it via a transform would produce. MapTiler serves its
// own glyphs and sprite from this style, so no separate glyph URL is needed:
// the cluster-count / start-marker SymbolLayers request "Noto Sans Regular",
// which MapTiler's font endpoint provides.
const STYLE_URL = `https://api.maptiler.com/maps/${MAPTILER_STYLE_ID}/style.json?key=${MAPTILER_API_KEY}`;

// The map is intentionally always the light Outdoor style, including in the
// app's dark mode: a legible dark topographic map needs a separately tuned
// custom style (MapTiler's off-the-shelf "Outdoor Dark" is night-vision dark
// and hard to read), which is a dedicated follow-up.
export function getMapStyle(): string {
  return STYLE_URL;
}

// Run once at app startup, before any map mounts.
export function initMapTiler(): void {
  // 1. Send the User-Agent the restricted key requires on every MapTiler
  //    request. Stable id so re-registration is an in-place update.
  TransformRequestManager.addHeader({
    id: "maptiler-user-agent",
    match: "api\\.maptiler\\.com",
    name: "User-Agent",
    value: MAP_USER_AGENT,
  });

  // 2. Silence the benign "ParseStyle" warnings MapLibre-native emits for
  //    MapTiler style properties its (older) build doesn't recognize — the map
  //    renders correctly without them. Returning true suppresses that log;
  //    false lets everything else (e.g. the "Canceled" cache-corruption
  //    warnings we rely on) log as normal.
  LogManager.onLog((log) => log.level === "warn" && log.message.includes("ParseStyle"));
}
