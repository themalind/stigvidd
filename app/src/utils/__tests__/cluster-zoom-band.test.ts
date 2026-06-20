import { clusterZoomBand, isZoomOutsideBand, MERGE_ZOOM_OUT_CAP } from "../cluster-zoom-band";

describe("clusterZoomBand", () => {
  it("returns null when the zoom at tap time is unknown", () => {
    expect(clusterZoomBand(null, 12)).toBeNull();
    expect(clusterZoomBand(undefined, 12)).toBeNull();
  });

  it("uses the expansion zoom as the upper edge for a separable cluster", () => {
    // expansionZoom (12) is within the cap of z0 (11.9), so the merge distance is the
    // real split distance, not the cap.
    expect(clusterZoomBand(11.9, 12)).toEqual({ min: 11.9 - 0.1, max: 12 });
  });

  it("caps the zoom-out distance for a co-located cluster whose split zoom is far away", () => {
    // expansionZoom 18 is well above z0 9.5 → the lower edge is capped, not 18 - 9.5.
    expect(clusterZoomBand(9.5, 18)).toEqual({ min: 9.5 - MERGE_ZOOM_OUT_CAP, max: 18 });
  });

  it("gives a single trail no upper edge but keeps a capped lower edge", () => {
    expect(clusterZoomBand(10, undefined)).toEqual({ min: 10 - MERGE_ZOOM_OUT_CAP, max: Infinity });
  });

  it("treats an expansion zoom at or below the current zoom like a single trail", () => {
    // Can't split further by zooming in, so there's no upper edge.
    expect(clusterZoomBand(12, 12)).toEqual({ min: 12 - MERGE_ZOOM_OUT_CAP, max: Infinity });
    expect(clusterZoomBand(12, 11)).toEqual({ min: 12 - MERGE_ZOOM_OUT_CAP, max: Infinity });
  });

  it("honours a custom cap", () => {
    expect(clusterZoomBand(10, 20, 1)).toEqual({ min: 9, max: 20 });
  });
});

describe("isZoomOutsideBand", () => {
  const band = { min: 9.5, max: 12 };

  it("never closes when there is no band", () => {
    expect(isZoomOutsideBand(50, null)).toBe(false);
  });

  it("stays open within the band", () => {
    expect(isZoomOutsideBand(10.5, band)).toBe(false);
  });

  it("closes at or past the upper edge (cluster split)", () => {
    expect(isZoomOutsideBand(12, band)).toBe(true);
    expect(isZoomOutsideBand(13, band)).toBe(true);
  });

  it("closes at or past the lower edge (cluster merge)", () => {
    expect(isZoomOutsideBand(9.5, band)).toBe(true);
    expect(isZoomOutsideBand(8, band)).toBe(true);
  });

  it("a single-trail band (max = Infinity) only closes on zoom-out", () => {
    const single = { min: 9.7, max: Infinity };
    expect(isZoomOutsideBand(20, single)).toBe(false);
    expect(isZoomOutsideBand(9.7, single)).toBe(true);
  });
});
