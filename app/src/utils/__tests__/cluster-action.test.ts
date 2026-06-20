import { type ClusterActionConfig, decideClusterAction } from "../cluster-action";

const config: ClusterActionConfig = { clusterMaxZoom: 16, carouselMaxCount: 10 };

describe("decideClusterAction", () => {
  it("zooms in for a large cluster that separates at or below the max zoom", () => {
    expect(decideClusterAction(50, 12, config)).toEqual({ kind: "zoom", zoom: 12 });
  });

  it("zooms to the exact expansion zoom when it equals the max zoom boundary", () => {
    expect(decideClusterAction(50, 16, config)).toEqual({ kind: "zoom", zoom: 16 });
  });

  it("opens the carousel for a small cluster even when it would separate", () => {
    // pointCount within the carousel threshold → carousel regardless of zoom.
    expect(decideClusterAction(10, 12, config)).toEqual({ kind: "carousel" });
  });

  it("opens the carousel for a large but effectively co-located cluster", () => {
    // expansionZoom beyond clusterMaxZoom means zooming won't split it.
    expect(decideClusterAction(50, 17, config)).toEqual({ kind: "carousel" });
  });

  it("opens the carousel when the expansion zoom is unavailable", () => {
    expect(decideClusterAction(50, null, config)).toEqual({ kind: "carousel" });
    expect(decideClusterAction(50, undefined, config)).toEqual({ kind: "carousel" });
  });

  it("treats a point count just above the threshold as separable", () => {
    expect(decideClusterAction(11, 14, config)).toEqual({ kind: "zoom", zoom: 14 });
  });
});
