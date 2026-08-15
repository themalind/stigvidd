import { buildDecorativeRoute } from "@/utils/decorative-route";

function pointsFrom(d: string): [number, number][] {
  return d
    .split(/(?=[ML])/)
    .filter(Boolean)
    .map((segment) => {
      const [x, y] = segment.slice(1).trim().split(" ").map(Number);
      return [x, y] as [number, number];
    });
}

describe("buildDecorativeRoute", () => {
  it("spans the box horizontally, inside the padding", () => {
    const { d } = buildDecorativeRoute(300, 120, 16);
    const xs = pointsFrom(d).map(([x]) => x);

    expect(Math.min(...xs)).toBeCloseTo(16);
    expect(Math.max(...xs)).toBeCloseTo(284);
  });

  it("keeps the curve inside the box vertically", () => {
    const { d } = buildDecorativeRoute(300, 120, 16);

    for (const [, y] of pointsFrom(d)) {
      expect(y).toBeGreaterThanOrEqual(16);
      expect(y).toBeLessThanOrEqual(104);
    }
  });

  it("reports the exact summed length of its own segments", () => {
    const { d, length } = buildDecorativeRoute(300, 120);
    const points = pointsFrom(d);

    let measured = 0;
    for (let i = 1; i < points.length; i++) {
      measured += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    }

    // The path string rounds to two decimals, so allow a hair of drift.
    expect(length).toBeCloseTo(measured, 1);
  });

  it("is longer than a straight line across the same box", () => {
    const { length } = buildDecorativeRoute(300, 120, 16);

    expect(length).toBeGreaterThan(268);
  });

  it("exposes endpoints that match the path", () => {
    const { d, start, end } = buildDecorativeRoute(300, 120);
    const points = pointsFrom(d);

    expect(start[0]).toBeCloseTo(points[0][0], 1);
    expect(end[0]).toBeCloseTo(points[points.length - 1][0], 1);
  });

  it("wanders rather than sweeping in one direction", () => {
    const points = pointsFrom(buildDecorativeRoute(300, 120, 16).d);

    let reversals = 0;
    for (let i = 2; i < points.length; i++) {
      const previous = points[i - 1][1] - points[i - 2][1];
      const current = points[i][1] - points[i - 1][1];
      if (previous * current < 0) reversals++;
    }

    expect(reversals).toBeGreaterThanOrEqual(2);
  });

  it("survives a degenerate box without producing NaN", () => {
    const { d, length } = buildDecorativeRoute(20, 20, 16);

    expect(pointsFrom(d).every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    expect(Number.isFinite(length)).toBe(true);
  });
});
