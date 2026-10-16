// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// keep-comment: [longitude, latitude], the order GeoJSON and MapLibre use, unlike the wire format
export type LngLat = [number, number];

export type Jump = {
  // keep-comment: the segment from point index to point index + 1
  index: number;
  metres: number;
};

// keep-comment: recordings sample every few metres, so a longer step between two fixes is a GPS jump
export const DEFAULT_JUMP_METRES = 40;

const EARTH_RADIUS_METRES = 6_371_000;

export function parseCoordinates(json: string): LngLat[] {
  try {
    const raw: unknown = JSON.parse(json);
    if (!Array.isArray(raw)) return [];

    const path: LngLat[] = [];
    for (const point of raw as { latitude?: unknown; longitude?: unknown }[]) {
      const lat = point?.latitude;
      const lng = point?.longitude;
      if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
        path.push([lng, lat]);
      }
    }
    return path;
  } catch {
    return [];
  }
}

export function serializeCoordinates(path: LngLat[]): string {
  return JSON.stringify(path.map(([longitude, latitude]) => ({ latitude, longitude })));
}

export function distanceMetres(a: LngLat, b: LngLat): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METRES * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function pathLengthMetres(path: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distanceMetres(path[i - 1], path[i]);
  return total;
}

export function findJumps(path: LngLat[], thresholdMetres = DEFAULT_JUMP_METRES): Jump[] {
  const jumps: Jump[] = [];
  for (let i = 1; i < path.length; i++) {
    const metres = distanceMetres(path[i - 1], path[i]);
    if (metres > thresholdMetres) jumps.push({ index: i - 1, metres });
  }
  return jumps.sort((a, b) => b.metres - a.metres);
}

export function trimPath(path: LngLat[], start: number, end: number): LngLat[] {
  if (path.length === 0) return [];
  const from = Math.max(0, Math.min(start, end, path.length - 1));
  const to = Math.min(path.length - 1, Math.max(start, end, 0));
  return path.slice(from, to + 1);
}

export function movePoint(path: LngLat[], index: number, to: LngLat): LngLat[] {
  if (index < 0 || index >= path.length) return path;
  return path.map((point, i) => (i === index ? to : point));
}

// keep-comment: a path needs two points, so the last two are never removed
export function deletePoint(path: LngLat[], index: number): LngLat[] {
  if (path.length <= 2 || index < 0 || index >= path.length) return path;
  return path.filter((_, i) => i !== index);
}

// keep-comment: keeps both ends and replaces what lies strictly between them, e.g. a shortcut across water redrawn along the shore
export function replaceSection(path: LngLat[], from: number, to: number, drawn: LngLat[]): LngLat[] {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  if (start < 0 || end >= path.length || start === end) return path;
  return [...path.slice(0, start + 1), ...drawn, ...path.slice(end)];
}

export function formatMetres(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(2).replace(".", ",")} km`;
}
