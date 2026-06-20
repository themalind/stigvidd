// MapLibre LngLatBounds order: [west, south, east, north].
export type Bounds = [west: number, south: number, east: number, north: number];

// Computes the geographic bounding box of a set of GeoJSON positions, ready to
// be passed to a MapLibre Camera (fitBounds / bounds prop). Returns null for an
// empty input so callers can skip the camera move.
export default function getBoundsFromTrail(coords: GeoJSON.Position[]): Bounds | null {
  if (coords.length === 0) return null;

  let [minLng, minLat] = coords[0];
  let [maxLng, maxLat] = coords[0];

  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return [minLng, minLat, maxLng, maxLat];
}
