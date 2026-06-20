// Pure helpers for the carousel's "still matches the map" zoom band, extracted from
// the Map screen so the fiddly cluster merge/split math can be unit-tested without
// mounting a map (same pattern as cluster-action.ts). The screen only stores the
// band on tap and asks isZoomOutsideBand() on each region change.

export interface ClusterZoomBand {
  min: number;
  max: number;
}

// There's no "merge zoom" in the cluster API (only the split/expansion zoom), so the
// lower edge of the keep-open band mirrors the split distance — but capped at this
// many zoom levels. Without the cap, co-located clusters (whose split zoom is far
// above the map) would get a band reaching almost fully zoomed out and never dismiss
// on zoom-out, even though they merge with neighbours almost immediately.
export const MERGE_ZOOM_OUT_CAP = 0.3;

// The zoom band within which an open selection still matches the map. Zoom past the
// top and a cluster splits; zoom below the bottom and it merges into a bigger cluster
// — either way the carousel should be dismissed. A single trail never splits (no top,
// so max = Infinity) but still merges into a cluster on zoom-out, so it keeps a bottom.
//
// `z0` is the zoom at tap time (null/undefined when unknown → no band). `expansionZoom`
// is the cluster's split zoom from getClusterExpansionZoom (omitted for a single trail,
// or when it sits at/below the current zoom). `cap` bounds how far a zoom-out may travel
// before dismissing co-located clusters whose split zoom is far away.
export function clusterZoomBand(
  z0: number | null | undefined,
  expansionZoom: number | null | undefined,
  cap: number = MERGE_ZOOM_OUT_CAP,
): ClusterZoomBand | null {
  if (z0 == null) return null;

  if (expansionZoom != null && expansionZoom > z0) {
    // Cluster — up: keep open until it actually splits (its expansion zoom). Down:
    // mirror that distance, but cap it so co-located clusters still dismiss after a
    // reasonable zoom-out instead of never.
    const mergeDistance = Math.min(expansionZoom - z0, cap);
    return { min: z0 - mergeDistance, max: expansionZoom };
  }

  // Single trail — never splits on zoom-in (no top), but merges into a cluster on
  // zoom-out, so dismiss once zoomed out past the capped margin.
  return { min: z0 - cap, max: Infinity };
}

// True once a user zoom has moved out of the band, meaning the open cluster/trail no
// longer matches the map and its carousel should close. Panning and small zooms within
// the band keep it open. A null band (nothing open / zoom unknown at tap) never closes.
export function isZoomOutsideBand(zoom: number, band: ClusterZoomBand | null): boolean {
  return band != null && (zoom >= band.max || zoom <= band.min);
}
