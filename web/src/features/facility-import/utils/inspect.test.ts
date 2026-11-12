// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { inspectGeoJson, MAX_TYPE_VALUES, type FileSummary } from "./inspect";

const point = (properties: unknown) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [12, 57] },
  properties,
});
const file = (...features: unknown[]) => JSON.stringify({ type: "FeatureCollection", features });

function summaryOf(content: string): FileSummary {
  const inspection = inspectGeoJson(content);
  if (!inspection.ok) throw new Error(`expected a summary, got: ${inspection.error}`);
  return inspection.summary;
}

describe("inspectGeoJson", () => {
  it("lists each field with samples and its sorted distinct values", () => {
    const summary = summaryOf(
      file(point({ namn: "Kype", typ: "Vindskydd", fid: 1 }), point({ namn: "Öra", typ: "Grillplats", fid: 2 })),
    );

    expect(summary.points).toBe(2);
    expect(summary.fields).toEqual([
      { name: "namn", samples: ["Kype", "Öra"], values: ["Kype", "Öra"] },
      { name: "typ", samples: ["Vindskydd", "Grillplats"], values: ["Grillplats", "Vindskydd"] },
      { name: "fid", samples: ["1", "2"], values: ["1", "2"] },
    ]);
  });

  it("counts only points with properties and keeps a field that is always empty", () => {
    const line = { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: { namn: "Led" } };
    const summary = summaryOf(file(point({ namn: "Kype", url: " " }), line, point(null)));

    expect(summary.points).toBe(1);
    expect(summary.fields).toContainEqual({ name: "url", samples: [], values: null });
  });

  it("gives no values for a field with too many to map one by one", () => {
    const features = Array.from({ length: MAX_TYPE_VALUES + 1 }, (_, i) => point({ namn: `Plats ${i}` }));

    const [namn] = summaryOf(file(...features)).fields;

    expect(namn?.values).toBeNull();
    expect(namn?.samples).toHaveLength(3);
  });

  it.each([
    ["not json", "The file is not valid GeoJSON."],
    ['{"type":"Feature"}', "The file has no features."],
    [file(point(null)), "The file has no point features with properties."],
  ])("refuses %s", (content, error) => {
    expect(inspectGeoJson(content)).toEqual({ ok: false, error });
  });
});
