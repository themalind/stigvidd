// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { LogManager, TransformRequestManager } from "@maplibre/maplibre-react-native";

// The style id swaps to a custom clone with MapTiler's hiking routes hidden, so ours are the only ones. keep-comment: planned change, not in code
const MAPTILER_API_KEY = process.env.EXPO_PUBLIC_MAPTILER_API_KEY;
const MAPTILER_STYLE_ID = process.env.EXPO_PUBLIC_MAPTILER_STYLE_ID;

// Must match the key's "Allowed user-agent header" in MapTiler Cloud, or every tile is refused. keep-comment: external config
const MAP_USER_AGENT = "stigvidd";

// The key ships in the bundle anyway; the user-agent and spending limit protect it. keep-comment: security reasoning
function styleUrl(styleId: string | undefined): string {
  return `https://api.maptiler.com/maps/${styleId}/style.json?key=${MAPTILER_API_KEY}`;
}

export type Basemap = "outdoor" | "satellite";

const STYLE_URLS: Record<Basemap, string> = {
  outdoor: styleUrl(MAPTILER_STYLE_ID),
  satellite: styleUrl("hybrid-v4"),
};

// keep-comment: outdoor-v2's Background layer runs hsl(86,39%,93%) at z5 to hsl(120,4%,95%) at z14; hybrid has none
const LOADING_COLOURS: Record<Basemap, { cover: string; spinner: string }> = {
  outdoor: { cover: "#F0F3EC", spinner: "#4F5D48" },
  satellite: { cover: "#26302A", spinner: "#C9D4C2" },
};

export function getMapLoadingColours(basemap: Basemap = "outdoor") {
  return LOADING_COLOURS[basemap];
}

// Stays light in dark mode: MapTiler's "Outdoor Dark" is too dark to read. keep-comment: deliberate, not an oversight
export function getMapStyle(basemap: Basemap = "outdoor"): string {
  return STYLE_URLS[basemap];
}

// Before any map mounts. keep-comment: ordering constraint
export function initMapTiler(): void {
  TransformRequestManager.addHeader({
    id: "maptiler-user-agent",
    match: "api\\.maptiler\\.com",
    name: "User-Agent",
    value: MAP_USER_AGENT,
  });

  // Hides MapLibre's harmless "ParseStyle" warnings about MapTiler properties; "Canceled" must still log. keep-comment: map-cache relies on it
  LogManager.onLog((log) => log.level === "warn" && log.message.includes("ParseStyle"));
}
