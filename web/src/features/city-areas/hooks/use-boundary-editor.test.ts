// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { GeoJSONStoreFeatures } from "terra-draw";
import { toBoundary, toFeatures } from "./use-boundary-editor";

const RING = [
  [12.9, 57.7],
  [12.95, 57.7],
  [12.95, 57.75],
  [12.9, 57.7],
];

describe("boundary editor conversion", () => {
  it("turns each part of the boundary into a polygon feature and back", () => {
    const boundary = [[RING], [RING.map(([lon, lat]) => [lon + 1, lat])]];

    const features = toFeatures(boundary);

    expect(features).toHaveLength(2);
    expect(features.every((feature) => feature.properties.mode === "polygon")).toBe(true);
    expect(new Set(features.map((feature) => feature.id)).size).toBe(2);
    expect(toBoundary(features)).toEqual(boundary);
  });

  it("leaves out a part still being drawn and the select handles", () => {
    const [part] = toFeatures([[RING]]);
    const drawing: GeoJSONStoreFeatures = {
      ...part,
      id: "drawing",
      properties: { mode: "polygon", currentlyDrawing: true },
    };
    const handle: GeoJSONStoreFeatures = {
      id: "handle",
      type: "Feature",
      geometry: { type: "Point", coordinates: [12.9, 57.7] },
      properties: { mode: "select", selectionPoint: true },
    };

    expect(toBoundary([part, drawing, handle])).toEqual([[RING]]);
  });
});
