// Pure decision logic for what should happen when a trail cluster is tapped,
// extracted from the map component so it can be unit-tested in isolation. The
// map layer stays a thin shell that only performs the resulting camera move or
// carousel open — see trail-markers-map.tsx.

export type ClusterAction = { readonly kind: "zoom"; readonly zoom: number } | { readonly kind: "carousel" };

export interface ClusterActionConfig {
  /**
   * A cluster whose expansion zoom is beyond this value is treated as
   * co-located (zooming in won't separate it), so it opens the carousel instead.
   */
  readonly clusterMaxZoom: number;
  /**
   * Clusters with at most this many points open the carousel directly rather
   * than zooming — they're usually trails sharing a trailhead.
   */
  readonly carouselMaxCount: number;
}

// Decides whether tapping a cluster should zoom the camera in (large clusters
// that genuinely break apart) or open the trail-card carousel (small or
// effectively co-located clusters). `expansionZoom` is the zoom at which the
// cluster would split, as reported by MapLibre's getClusterExpansionZoom — it
// may be null/undefined when unavailable, in which case we fall back to the
// carousel.
export function decideClusterAction(
  pointCount: number,
  expansionZoom: number | null | undefined,
  config: ClusterActionConfig,
): ClusterAction {
  if (expansionZoom != null && expansionZoom <= config.clusterMaxZoom && pointCount > config.carouselMaxCount) {
    return { kind: "zoom", zoom: expansionZoom };
  }

  return { kind: "carousel" };
}
