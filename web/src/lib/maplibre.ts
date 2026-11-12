// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  LngLatBounds,
  setWorkerUrl,
  type FitBoundsOptions,
  type GeoJSONSource,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// keep-comment: a bundled maplibre cannot find its own worker, and without one no source ever loads
setWorkerUrl(workerUrl);

// keep-comment: the app's MapTiler key is locked to a User-Agent a browser cannot send, so the admin needs its own origin-restricted key
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

export const hasSatellite = Boolean(MAPTILER_KEY);

// keep-comment: shared by every admin map, so a trail, its start and its end look the same on each page
export const MAP_COLORS = {
  trail: "#134a5b",
  start: "#2e7d32",
  end: "#b3261e",
} as const;

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export function mapStyle(satellite: boolean): string | StyleSpecification {
  if (!MAPTILER_KEY) return OSM_STYLE;
  const style = satellite ? "hybrid" : "outdoor-v2";
  return `https://api.maptiler.com/maps/${style}/style.json?key=${MAPTILER_KEY}`;
}

export function upsertSource(map: MapLibreMap, id: string, data: GeoJSON.FeatureCollection): void {
  const source = map.getSource<GeoJSONSource>(id);
  if (source) source.setData(data);
  else map.addSource(id, { type: "geojson", data });
}

export function fitTo(map: MapLibreMap, points: GeoJSON.Position[], options: FitBoundsOptions): void {
  if (points.length < 2) return;

  const bounds = new LngLatBounds();
  for (const [lng, lat] of points) bounds.extend([lng, lat]);
  map.fitBounds(bounds, options);
}
