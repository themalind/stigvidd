// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { lngLat } from "@/utils/geo/geojson";

// keep-comment: past this the points are closer than a thumbnail pixel
const MAX_POINTS = 120;

export interface RouteThumbnail {
  d: string;
  start: [number, number];
  end: [number, number];
}

// keep-comment: a degree of longitude is about half a degree of latitude here, or every track leans east-west
function longitudeScale(latitude: number): number {
  return Math.cos((latitude * Math.PI) / 180);
}

// keep-comment: always keeps the last point, where the walk ended
function downsample(path: GeoJSON.Position[]): GeoJSON.Position[] {
  if (path.length <= MAX_POINTS) return path;

  const stride = (path.length - 1) / (MAX_POINTS - 1);
  const picked = new Set(Array.from({ length: MAX_POINTS - 1 }, (_, i) => Math.round(i * stride)));
  picked.add(path.length - 1);
  return path.filter((_, index) => picked.has(index));
}

// keep-comment: null when there is nothing to draw, which tells the caller to show the icon
export function buildRouteThumbnail(
  path: GeoJSON.Position[],
  width: number,
  height: number,
  padding = 6,
): RouteThumbnail | null {
  if (path.length < 2) return null;

  const points = downsample(path);

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const position of points) {
    const [lng, lat] = lngLat(position);
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const aspect = longitudeScale((minLat + maxLat) / 2);
  const spanX = (maxLng - minLng) * aspect;
  const spanY = maxLat - minLat;

  const innerWidth = Math.max(width - padding * 2, 0);
  const innerHeight = Math.max(height - padding * 2, 0);
  // keep-comment: Infinity for a flat axis, so a due-north track scales by the other one
  const scale = Math.min(spanX > 0 ? innerWidth / spanX : Infinity, spanY > 0 ? innerHeight / spanY : Infinity);
  if (!Number.isFinite(scale)) return null;

  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  // keep-comment: latitude grows north, SVG y grows down
  const project = (position: GeoJSON.Position): [number, number] => {
    const [lng, lat] = lngLat(position);
    return [offsetX + (lng - minLng) * aspect * scale, offsetY + (maxLat - lat) * scale];
  };

  const projected = points.map(project);
  const d = projected.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");

  const [start] = projected;
  const end = projected.at(-1);
  if (!start || !end) return null;
  return { d, start, end };
}
