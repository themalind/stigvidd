// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The geometry the import preview draws with: longitude/latitude projected to metres, and
 * the view arithmetic that fits, zooms and thins a line for an SVG viewBox.
 *
 * Extracted from geometry-preview.tsx so the arithmetic can be tested without a browser.
 * What the reviewer decides on is a drawing of two lines, so a fold here is a fold in the
 * evidence — a line that looks like it runs along a trail when it does not.
 */

/** [longitude, latitude] pairs, the order the API sends. */
export type Coordinates = number[][];

export type Point = { x: number; y: number };
export type View = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };

// Metres per degree of latitude. Longitude shrinks towards the poles, so it is scaled by
// cos(latitude) — without that, a trail at 57°N is drawn almost twice as wide as it is.
export const MetresPerDegree = 111_320;

// Roughly how many points a line is drawn with at the fitted view. Each zoom level halves
// the stride, so zooming in is what reveals detail rather than hiding it.
export const MaxPoints = 1500;

// How far out and in the view may go, relative to the fitted extent.
export const MaxZoomOut = 3;
export const MinSpanMetres = 25;

/** A round number for the scale bar: 1, 2 or 5 times a power of ten. */
export function niceDistance(metres: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(metres));
  const normalised = metres / magnitude;
  const step = normalised >= 5 ? 5 : normalised >= 2 ? 2 : 1;

  return step * magnitude;
}

export function formatDistance(metres: number): string {
  return metres >= 1000
    ? `${(metres / 1000).toLocaleString()} km`
    : `${Math.round(metres)} m`;
}

export function boundsOf(lines: Point[][], padding: number): View {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const line of lines) {
    for (const point of line) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
  }

  // A closed loop or a single straight line can have no extent in one direction.
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const pad = Math.max(width, height) * padding;

  return {
    x: minX - pad,
    y: minY - pad,
    w: width + pad * 2,
    h: height + pad * 2,
  };
}

// A power of two, so each zoom level draws a superset of the points the level before did.
export function strideFor(count: number, detail: number): number {
  if (count <= MaxPoints) return 1;

  const base = 2 ** Math.ceil(Math.log2(count / MaxPoints));

  return Math.max(1, base / 2 ** detail);
}

// The line thinned to the stride for this zoom level, with everything outside the painted
// area dropped and the path broken there: a chord between two points far apart off-screen
// would otherwise be drawn straight across the picture.
export function pathFor(points: Point[], area: View, detail: number): string {
  if (points.length < 2) return "";

  const stride = strideFor(points.length, detail);
  const margin = Math.max(area.w, area.h) * 0.15;
  const minX = area.x - margin;
  const maxX = area.x + area.w + margin;
  const minY = area.y - margin;
  const maxY = area.y + area.h + margin;

  const inside = (point: Point | undefined) =>
    point !== undefined &&
    point.x >= minX &&
    point.x <= maxX &&
    point.y >= minY &&
    point.y <= maxY;

  const last = points.length - 1;

  let d = "";
  let pen = "M";

  for (let i = 0; i <= last; i++) {
    if (i % stride !== 0 && i !== last) continue;

    // The neighbours on the drawn skeleton, so a segment entering the view is kept whole.
    const near =
      inside(points[i]) ||
      inside(points[i - stride]) ||
      inside(points[Math.min(i + stride, last)]);

    if (!near) {
      pen = "M";
      continue;
    }

    d += `${pen}${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
    pen = "L";
  }

  return d;
}

// Keeps the span within the zoom limits and the centre near the drawn lines, so a fast
// drag cannot leave the reviewer looking at empty space with no way back.
export function clampView(view: View, fit: View): View {
  const maxWidth = fit.w * MaxZoomOut;
  const minWidth = Math.max(MinSpanMetres, fit.w / 500);
  const width = Math.min(maxWidth, Math.max(minWidth, view.w));
  const height = width * (view.h / view.w);

  const centreX = Math.min(
    fit.x + fit.w + width / 2,
    Math.max(fit.x - width / 2, view.x + view.w / 2),
  );
  const centreY = Math.min(
    fit.y + fit.h + height / 2,
    Math.max(fit.y - height / 2, view.y + view.h / 2),
  );

  return {
    x: centreX - width / 2,
    y: centreY - height / 2,
    w: width,
    h: height,
  };
}

/** Pixels per metre once preserveAspectRatio="meet" has fitted the view into the box. */
export function pixelsPerMetre(view: View, size: Size): number {
  if (!size.w || !size.h) return 0;

  return Math.min(size.w / view.w, size.h / view.h);
}

/** The world rectangle actually painted: "meet" shows more than the view along one axis. */
export function paintedArea(view: View, size: Size): View {
  const scale = pixelsPerMetre(view, size);
  if (!scale) return view;

  const width = size.w / scale;
  const height = size.h / scale;

  return {
    x: view.x + view.w / 2 - width / 2,
    y: view.y + view.h / 2 - height / 2,
    w: width,
    h: height,
  };
}

export type Drawing = {
  featurePoints: Point[];
  trailPoints: Point[] | null;
  featureEnds: Point[];
  fitFeature: View;
  fitAll: View;
};

/**
 * Both lines projected into one metric plane and fitted. Null when there is nothing with
 * two points to draw, which is what the empty state is keyed off.
 */
export function projectDrawing(
  feature: Coordinates,
  trail?: Coordinates | null,
): Drawing | null {
  const lines = [feature, trail ?? []].filter((line) => line.length >= 2);
  if (lines.length === 0) return null;

  // Walked rather than spread: Sjuhäradsrundan alone is 59 000 points, and
  // Math.min(...points) at that size overruns the argument limit.
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const line of lines) {
    for (const [lon, lat] of line) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }

  const metresPerLon =
    MetresPerDegree * Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);

  const project = (line: Coordinates): Point[] =>
    line.map(([lon, lat]) => ({
      x: (lon - minLon) * metresPerLon,
      y: (maxLat - lat) * MetresPerDegree,
    }));

  const featurePoints = project(feature);
  const trailPoints = trail && trail.length >= 2 ? project(trail) : null;

  return {
    featurePoints,
    trailPoints,
    featureEnds: [featurePoints[0], featurePoints[featurePoints.length - 1]],
    fitFeature: boundsOf([featurePoints], 0.1),
    fitAll: boundsOf(
      trailPoints ? [featurePoints, trailPoints] : [featurePoints],
      0.06,
    ),
  };
}
