import type { StyleSpecification } from "@maplibre/maplibre-react-native";

// Thunderforest "Outdoors" — a detailed topographic style with paths, contours
// and terrain shading, well suited for hiking. The API key is read from the same
// EXPO_PUBLIC_* env mechanism as BASE_URL in api-config, never hard-coded.
const THUNDERFOREST_API_KEY = process.env.EXPO_PUBLIC_THUNDERFOREST_API_KEY;

const ATTRIBUTION = "Maps © Thunderforest, Data © OpenStreetMap contributors";

// Glyphs are needed for the cluster-count text labels (SymbolLayer text-field).
// The Thunderforest raster source provides no glyphs, so we point at OpenFreeMap's
// free glyph server (no API key). It serves "Noto Sans Regular" as valid protobuf
// glyphs — the font the cluster-count layer requests. Note: a glyph endpoint that
// returns non-PBF data (e.g. an HTML error page) throws a hard parse exception that
// blanks the whole style, so the source here must return real protobuf glyphs.
const GLYPHS_URL = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

function buildStyle(mapName: string): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      thunderforest: {
        type: "raster",
        tiles: [`https://tile.thunderforest.com/${mapName}/{z}/{x}/{y}.png?apikey=${THUNDERFOREST_API_KEY}`],
        tileSize: 256,
        attribution: ATTRIBUTION,
      },
    },
    layers: [{ id: "thunderforest", type: "raster", source: "thunderforest" }],
  };
}

// The map is intentionally always the light "Outdoors" style, including in the
// app's dark mode: Thunderforest has no dark topographic variant (only the non-topo
// transport-dark / spinal-map styles), and the light topo map reads best for hiking.
const OUTDOORS_STYLE = buildStyle("outdoors");

export function getMapStyle(): StyleSpecification {
  return OUTDOORS_STYLE;
}
