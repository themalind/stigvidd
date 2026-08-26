import { describe, expect, it } from "vitest";
import {
  boundsOf,
  clampView,
  formatDistance,
  MaxPoints,
  niceDistance,
  paintedArea,
  pathFor,
  pixelsPerMetre,
  projectDrawing,
  strideFor,
  type Point,
} from "./geometry-preview";

const line = (...xs: number[]): Point[] => xs.map((x) => ({ x, y: 0 }));

describe("projectDrawing", () => {
  // Borås. One degree of longitude here is about 59.5 km, not 111.3.
  const lat = 57.7;

  it("scales longitude by the cosine of the latitude", () => {
    const drawing = projectDrawing([
      [13.0, lat],
      [13.1, lat],
    ]);

    const width = drawing!.featurePoints[1].x;

    expect(width).toBeCloseTo(
      0.1 * 111_320 * Math.cos((lat * Math.PI) / 180),
      0,
    );
    // The assertion that matters: unscaled, this would be 11 132 m — nearly twice as wide.
    expect(width).toBeLessThan(6500);
  });

  it("puts north at the top, where SVG wants it", () => {
    const drawing = projectDrawing([
      [13, 57.7],
      [13, 57.8],
    ]);

    const [south, north] = drawing!.featurePoints;

    expect(north.y).toBeLessThan(south.y);
    expect(south.y).toBeCloseTo(0.1 * 111_320, 0);
  });

  it("starts the plane at the north-west corner of everything drawn", () => {
    const drawing = projectDrawing([
      [13.1, 57.7],
      [13.0, 57.8],
    ]);

    const xs = drawing!.featurePoints.map((p) => p.x);
    const ys = drawing!.featurePoints.map((p) => p.y);

    expect(Math.min(...xs)).toBe(0);
    expect(Math.min(...ys)).toBe(0);
  });

  // Both lines have to land in one plane or the drawing is a lie about where they run.
  it("projects the trail against the same origin as the feature", () => {
    const drawing = projectDrawing(
      [
        [13.0, 57.7],
        [13.1, 57.7],
      ],
      [
        [13.0, 57.7],
        [13.1, 57.7],
      ],
    );

    expect(drawing!.trailPoints).toEqual(drawing!.featurePoints);
  });

  it("widens the origin to take in a trail that reaches further west", () => {
    const feature: number[][] = [
      [13.0, 57.7],
      [13.1, 57.7],
    ];
    const alone = projectDrawing(feature)!;
    const withTrail = projectDrawing(feature, [
      [12.9, 57.7],
      [13.0, 57.7],
    ])!;

    expect(alone.featurePoints[0].x).toBe(0);
    expect(withTrail.featurePoints[0].x).toBeGreaterThan(0);
  });

  // The fitted view is what the reviewer first sees. Leaving the trail out of it would
  // hide the very stretch the feature is being compared against.
  it("fits both lines, not only the feature", () => {
    const feature: number[][] = [
      [13.0, 57.7],
      [13.01, 57.7],
    ];
    const drawing = projectDrawing(feature, [
      [13.0, 57.7],
      [13.2, 57.7],
    ])!;

    const right = drawing.trailPoints!.at(-1)!.x;

    expect(drawing.fitAll.x + drawing.fitAll.w).toBeGreaterThan(right);
    expect(drawing.fitFeature.w).toBeLessThan(drawing.fitAll.w);
  });

  it("names the two ends of the feature", () => {
    const drawing = projectDrawing([
      [13.0, 57.7],
      [13.05, 57.7],
      [13.1, 57.7],
    ]);

    expect(drawing!.featureEnds).toEqual([
      drawing!.featurePoints[0],
      drawing!.featurePoints[2],
    ]);
  });

  it("has nothing to draw when neither line has two points", () => {
    expect(projectDrawing([])).toBeNull();
    expect(projectDrawing([[13, 57.7]])).toBeNull();
    expect(projectDrawing([[13, 57.7]], [[13, 57.7]])).toBeNull();
  });

  it("draws the trail alone when the feature is a single point", () => {
    const drawing = projectDrawing(
      [[13, 57.7]],
      [
        [13, 57.7],
        [13.1, 57.7],
      ],
    );

    expect(drawing).not.toBeNull();
    expect(drawing!.trailPoints).toHaveLength(2);
  });

  it("ignores a trail too short to be a line", () => {
    const drawing = projectDrawing(
      [
        [13.0, 57.7],
        [13.1, 57.7],
      ],
      [[13, 57.7]],
    );

    expect(drawing!.trailPoints).toBeNull();
    expect(drawing!.fitAll).toEqual(
      projectDrawing([
        [13.0, 57.7],
        [13.1, 57.7],
      ])!.fitAll,
    );
  });

  // Sjuhäradsrundan is 59 000 points on its own. Math.min(...points) at that size throws
  // "Maximum call stack size exceeded", which is why the bounds are walked.
  it("survives a line of sixty thousand points", () => {
    const long = Array.from({ length: 60_000 }, (_, i) => [
      13 + i * 1e-6,
      57.7 + i * 1e-6,
    ]);

    expect(() => projectDrawing(long)).not.toThrow();
    expect(projectDrawing(long)!.featurePoints).toHaveLength(60_000);
  });
});

describe("boundsOf", () => {
  it("pads by a share of the longer side, so the padding is square", () => {
    const view = boundsOf(
      [
        [
          { x: 0, y: 0 },
          { x: 100, y: 50 },
        ],
      ],
      0.1,
    );

    expect(view).toEqual({ x: -10, y: -10, w: 120, h: 70 });
  });

  it("gives a straight line an extent to be drawn in", () => {
    const view = boundsOf([line(0, 100)], 0);

    expect(view.h).toBe(1);
    expect(view.w).toBe(100);
  });

  it("takes in every line it is given", () => {
    const view = boundsOf([line(0, 10), line(-50, 500)], 0);

    expect(view.x).toBe(-50);
    expect(view.w).toBe(550);
  });
});

describe("strideFor", () => {
  it("draws every point of a line that is short enough", () => {
    expect(strideFor(MaxPoints, 0)).toBe(1);
    expect(strideFor(MaxPoints, 4)).toBe(1);
  });

  it("thins a long line by a power of two", () => {
    // 59 000 / 1500 is 39.3, so the next power of two up is 64.
    expect(strideFor(59_000, 0)).toBe(64);
  });

  it("halves the stride at each zoom level, and never goes below one", () => {
    expect(strideFor(59_000, 1)).toBe(32);
    expect(strideFor(59_000, 6)).toBe(1);
    expect(strideFor(59_000, 20)).toBe(1);
  });

  // Zooming in must reveal points, never trade one set of points for another: the line
  // would appear to wobble as the reviewer zoomed.
  it("draws a superset of the level before it", () => {
    const drawn = (detail: number) => {
      const stride = strideFor(59_000, detail);
      const kept = new Set<number>();
      for (let i = 0; i < 59_000; i += stride) kept.add(i);
      return kept;
    };

    const coarse = drawn(2);
    const fine = drawn(3);

    for (const i of coarse) expect(fine.has(i)).toBe(true);
  });
});

describe("pathFor", () => {
  // 15% of the longer side, so points out to x = 128 still count as near.
  const area = { x: -10, y: -10, w: 120, h: 120 };

  it("draws nothing from a line with fewer than two points", () => {
    expect(pathFor(line(0), area, 0)).toBe("");
    expect(pathFor([], area, 0)).toBe("");
  });

  it("keeps the first point outside the view, so the line reaches the edge", () => {
    expect(pathFor(line(0, 100, 200, 300, 400), area, 0)).toBe(
      "M0.0 0.0L100.0 0.0L200.0 0.0",
    );
  });

  // Without the break, the pen would be drawn straight across the picture from one
  // off-screen point to another, and the reviewer would see a line that is not there.
  it("lifts the pen for a stretch that leaves and comes back", () => {
    const d = pathFor(line(0, 1000, 2000, 3000, 100), area, 0);

    expect(d.match(/M/g)).toHaveLength(2);
    expect(d.endsWith("L100.0 0.0")).toBe(true);
  });

  // The view is grown by 15% before anything is dropped, so a point just off the frame
  // still counts as inside — and the stretch running away from it is drawn to the edge
  // rather than stopping short of it.
  it("counts a point just past the edge as inside", () => {
    const tight = { x: 0, y: 0, w: 100, h: 100 };

    // 110 is outside the view but inside the margin, and it is what keeps 500 on the path.
    expect(pathFor(line(50, 110, 500, 600), tight, 0)).toBe(
      "M50.0 0.0L110.0 0.0L500.0 0.0",
    );
  });

  it("keeps nothing when the whole line is elsewhere", () => {
    expect(pathFor(line(9000, 9100, 9200), area, 0)).toBe("");
  });

  // The end of a line is where it meets the next one, so it is drawn whatever the stride.
  it("thins by the stride but always draws the last point", () => {
    const points = Array.from({ length: 6002 }, (_, i) => ({ x: i, y: 0 }));
    const wide = { x: 0, y: 0, w: 7000, h: 7000 };

    const drawn = pathFor(points, wide, 0).split(/[ML]/).filter(Boolean);

    // 6002 / 1500 rounds up to a stride of 8; index 6001 is not a multiple of it.
    expect(strideFor(points.length, 0)).toBe(8);
    expect(drawn).toHaveLength(6000 / 8 + 1 + 1);
    expect(drawn.at(-2)).toBe("6000.0 0.0");
    expect(drawn.at(-1)).toBe("6001.0 0.0");
  });
});

describe("clampView", () => {
  const fit = { x: 0, y: 0, w: 1000, h: 500 };

  it("will not zoom further out than three times the fitted extent", () => {
    const view = clampView({ x: 0, y: 0, w: 10_000, h: 5_000 }, fit);

    expect(view.w).toBe(3000);
    expect(view.h / view.w).toBeCloseTo(0.5);
  });

  // The view's own shape, not the drawing's: the box is what the view has to fit into,
  // and taking the fit's ratio would squash the picture as soon as the two differed.
  it("keeps the shape of the view it was given", () => {
    const square = clampView({ x: 0, y: 0, w: 10_000, h: 10_000 }, fit);

    expect(square.h).toBe(square.w);
  });

  it("stops zooming in at twenty-five metres across", () => {
    const view = clampView({ x: 0, y: 0, w: 1, h: 0.5 }, fit);

    expect(view.w).toBe(25);
  });

  it("takes the tighter of the two limits for a small drawing", () => {
    // A 100 m drawing would allow a fifth of a metre; the floor of 25 m is what bites.
    const tiny = { x: 0, y: 0, w: 100, h: 100 };

    expect(clampView({ x: 0, y: 0, w: 0.001, h: 0.001 }, tiny).w).toBe(25);
  });

  // A fast drag must not leave the reviewer looking at empty space with no way back.
  it("will not let the drawing off the far edge", () => {
    const view = clampView({ x: 99_000, y: 0, w: 1000, h: 500 }, fit);

    expect(view.x).toBe(fit.x + fit.w);
  });

  it("clamps the other way too", () => {
    const view = clampView({ x: -99_000, y: -99_000, w: 1000, h: 500 }, fit);

    expect(view.x + view.w).toBe(fit.x);
    expect(view.y + view.h).toBe(fit.y);
  });

  it("leaves a view already inside the limits alone", () => {
    const inside = { x: 200, y: 100, w: 400, h: 200 };

    expect(clampView(inside, fit)).toEqual(inside);
  });
});

describe("pixelsPerMetre", () => {
  it("fits the view into the box by its tighter side", () => {
    expect(
      pixelsPerMetre({ x: 0, y: 0, w: 100, h: 100 }, { w: 200, h: 50 }),
    ).toBe(0.5);
  });

  // The box is measured by a ResizeObserver, so the first render has no size at all.
  it("is zero before the box has been measured", () => {
    expect(pixelsPerMetre({ x: 0, y: 0, w: 100, h: 100 }, { w: 0, h: 0 })).toBe(
      0,
    );
    expect(
      pixelsPerMetre({ x: 0, y: 0, w: 100, h: 100 }, { w: 200, h: 0 }),
    ).toBe(0);
  });
});

describe("paintedArea", () => {
  // "meet" fits the whole view in and shows more than was asked for along the other axis.
  it("widens the world rectangle to the shape of the box", () => {
    const painted = paintedArea(
      { x: 0, y: 0, w: 100, h: 100 },
      { w: 200, h: 100 },
    );

    expect(painted).toEqual({ x: -50, y: 0, w: 200, h: 100 });
  });

  it("keeps the centre where the view put it", () => {
    const painted = paintedArea(
      { x: 40, y: 40, w: 20, h: 20 },
      { w: 100, h: 100 },
    );

    expect(painted.x + painted.w / 2).toBe(50);
    expect(painted.y + painted.h / 2).toBe(50);
  });

  it("hands back the view unchanged when there is no box to fit it into", () => {
    const view = { x: 0, y: 0, w: 100, h: 100 };

    expect(paintedArea(view, { w: 0, h: 0 })).toBe(view);
  });
});

describe("the scale bar", () => {
  it("rounds to one, two or five times a power of ten", () => {
    expect(niceDistance(1200)).toBe(1000);
    expect(niceDistance(3700)).toBe(2000);
    expect(niceDistance(8000)).toBe(5000);
    expect(niceDistance(0.4)).toBeCloseTo(0.2);
  });

  it("switches to kilometres at a thousand metres", () => {
    expect(formatDistance(999)).toBe("999 m");
    expect(formatDistance(1000)).toBe("1 km");
    expect(formatDistance(2000)).toBe("2 km");
  });

  it("rounds metres rather than showing a fraction of one", () => {
    expect(formatDistance(12.4)).toBe("12 m");
  });
});
