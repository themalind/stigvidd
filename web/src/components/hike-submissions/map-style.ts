// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { StyleSpecification } from "maplibre-gl";

// keep-comment: the app's MapTiler key is locked to a User-Agent a browser cannot send, so the admin needs its own origin-restricted key
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

export const hasSatellite = Boolean(MAPTILER_KEY);

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
