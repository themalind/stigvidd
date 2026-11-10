// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// Projects a recorded GPS track into a small SVG path, so a hike row can show its own
// shape instead of a shared icon. Unlike decorative-route this is data: the outline is
// the actual track.

// Above this the points are closer together than a thumbnail pixel, so the extra detail
// only costs path-string length.
const MAX_POINTS = 120;

export interface RouteThumbnail {
  d: string;
  start: [number, number];
  end: [number, number];
}

// Longitude degrees shrink towards the poles; at Swedish latitudes a degree of longitude
// is about half a degree of latitude, so without this every track leans east-west.
function longitudeScale(latitude: number): number {
  return Math.cos((latitude * Math.PI) / 180);
}

// Even stride, with the last point kept: dropping it would cut the track short of where
// the walk ended, which is exactly the end marker's position.
function downsample(path: GeoJSON.Position[]): GeoJSON.Position[] {
  if (path.length <= MAX_POINTS) return path;

  const stride = (path.length - 1) / (MAX_POINTS - 1);
  const sampled: GeoJSON.Position[] = [];
  for (let i = 0; i < MAX_POINTS - 1; i++) {
    sampled.push(path[Math.round(i * stride)]);
  }
  sampled.push(path[path.length - 1]);
  return sampled;
}

/**
 * Fits `path` into a `width` x `height` box, preserving its aspect ratio so an
 * out-and-back stays a line and a loop stays a loop. Returns null for a track that has no
 * extent to draw — fewer than two points, or every point in the same spot — which is the
 * caller's cue to fall back to an icon.
 */
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
  for (const [lng, lat] of points) {
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
  // Infinity for an axis with no extent, so a due-north track scales by the other one.
  const scale = Math.min(spanX > 0 ? innerWidth / spanX : Infinity, spanY > 0 ? innerHeight / spanY : Infinity);
  if (!Number.isFinite(scale)) return null;

  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  // Latitude grows north, SVG y grows down.
  const project = (position: GeoJSON.Position): [number, number] => [
    offsetX + (position[0] - minLng) * aspect * scale,
    offsetY + (maxLat - position[1]) * scale,
  ];

  const projected = points.map(project);
  const d = projected.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");

  return { d, start: projected[0], end: projected[projected.length - 1] };
}
