// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  deletePoint,
  distanceMetres,
  findJumps,
  formatMetres,
  extendPath,
  insertPoint,
  isLoop,
  type LngLat,
  midpoints,
  movePoint,
  parseCoordinates,
  pathLengthMetres,
  replaceSection,
  reversePath,
  serializeCoordinates,
  startLoopAt,
  trimPath,
} from "./geometry-edit";

const a: LngLat = [12.94, 57.72];
const b: LngLat = [12.94, 57.7201];
const c: LngLat = [12.94, 57.7202];
const far: LngLat = [12.94, 57.7302];

describe("parseCoordinates / serializeCoordinates", () => {
  it("round-trips the wire format in lon/lat order", () => {
    const json = '[{"latitude":57.72,"longitude":12.94},{"latitude":57.73,"longitude":12.95}]';

    const path = parseCoordinates(json);

    expect(path).toEqual([
      [12.94, 57.72],
      [12.95, 57.73],
    ]);
    expect(JSON.parse(serializeCoordinates(path))).toEqual(JSON.parse(json));
  });

  it("drops broken points and survives garbage", () => {
    expect(parseCoordinates('[{"latitude":57.7},{"latitude":57.7,"longitude":12.9}]')).toEqual([[12.9, 57.7]]);
    expect(parseCoordinates("not json")).toEqual([]);
    expect(parseCoordinates('{"latitude":1}')).toEqual([]);
  });
});

describe("distances", () => {
  it("measures about 11 m per 0.0001 degree of latitude", () => {
    expect(distanceMetres(a, b)).toBeGreaterThan(10);
    expect(distanceMetres(a, b)).toBeLessThan(12);
  });

  it("sums the segments", () => {
    expect(pathLengthMetres([a, b, c])).toBeCloseTo(distanceMetres(a, b) + distanceMetres(b, c), 6);
    expect(pathLengthMetres([a])).toBe(0);
  });

  it("formats metres and kilometres", () => {
    expect(formatMetres(212.4)).toBe("212 m");
    expect(formatMetres(5300)).toBe("5,30 km");
  });
});

describe("findJumps", () => {
  it("flags only the long step, biggest first, by its starting index", () => {
    const jumps = findJumps([a, b, c, far, [12.94, 57.7303]]);

    expect(jumps).toHaveLength(1);
    expect(jumps[0].index).toBe(2);
    expect(jumps[0].metres).toBeGreaterThan(1000);
  });

  it("uses the threshold given", () => {
    expect(findJumps([a, b, c], 5)).toHaveLength(2);
    expect(findJumps([a, b, c], 50)).toHaveLength(0);
  });
});

describe("editing", () => {
  const path: LngLat[] = [a, b, c, far];

  it("trims to an inclusive, clamped range", () => {
    expect(trimPath(path, 1, 2)).toEqual([b, c]);
    expect(trimPath(path, -5, 99)).toEqual(path);
    expect(trimPath(path, 2, 1)).toEqual([b, c]);
  });

  it("moves one point and leaves the rest", () => {
    const moved = movePoint(path, 1, [1, 1]);

    expect(moved[1]).toEqual([1, 1]);
    expect(moved[0]).toBe(a);
    expect(path[1]).toBe(b);
  });

  it("deletes a point but never below two", () => {
    expect(deletePoint(path, 1)).toEqual([a, c, far]);
    expect(deletePoint([a, b], 0)).toEqual([a, b]);
  });

  it("replaces the section between two points with the drawn ones", () => {
    const drawn: LngLat[] = [
      [13, 57],
      [13.1, 57.1],
    ];

    expect(replaceSection(path, 0, 3, drawn)).toEqual([a, ...drawn, far]);
    expect(replaceSection(path, 3, 0, drawn)).toEqual([a, ...drawn, far]);
    expect(replaceSection(path, 1, 1, drawn)).toBe(path);
  });

  it("removes the section between two points by replacing it with nothing", () => {
    expect(replaceSection(path, 0, 3, [])).toEqual([a, far]);
  });

  it("inserts a point after the given index", () => {
    expect(insertPoint(path, 1, [1, 1])).toEqual([a, b, [1, 1], c, far]);
    expect(insertPoint(path, 3, [1, 1])).toBe(path);
  });

  it("puts a handle halfway along every segment", () => {
    expect(
      midpoints([
        [0, 0],
        [2, 4],
        [4, 4],
      ]),
    ).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("extends either end with points drawn outward from it", () => {
    const drawn: LngLat[] = [
      [1, 1],
      [2, 2],
    ];

    expect(extendPath([a, b], "end", drawn)).toEqual([a, b, [1, 1], [2, 2]]);
    expect(extendPath([a, b], "start", drawn)).toEqual([[2, 2], [1, 1], a, b]);
    expect(extendPath([a, b], "start", [])).toEqual([a, b]);
  });
});

describe("start point", () => {
  const east: LngLat = [12.9402, 57.7201];
  const loop: LngLat[] = [a, b, c, east, a];

  it("tells a loop from a walk that ends somewhere else", () => {
    expect(isLoop(loop)).toBe(true);
    expect(isLoop([a, b, c, far])).toBe(false);
  });

  it("rotates a loop to start and end at the chosen point, keeping every point", () => {
    expect(startLoopAt(loop, 2)).toEqual([c, east, a, a, b, c]);
    expect(startLoopAt(loop, 0)).toBe(loop);
  });

  it("refuses to rotate a walk that is not a loop", () => {
    expect(startLoopAt([a, b, c, far], 2)).toBeNull();
  });

  it("reverses the direction without touching the original", () => {
    const path: LngLat[] = [a, b, c];

    expect(reversePath(path)).toEqual([c, b, a]);
    expect(path).toEqual([a, b, c]);
  });
});
