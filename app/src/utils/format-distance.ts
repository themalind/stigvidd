// Formats a distance for display next to a trail or hike. GPS-derived distances
// carry far more precision than is meaningful, so metres round to the nearest 10
// and kilometres drop their decimal once the number is large enough that it stops
// telling the reader anything.

export function formatDistanceKm(km: number): string {
  const meters = Math.round((km * 1000) / 10) * 10;

  if (meters < 1000) return `${meters} m`;

  const value = km >= 10 ? Math.round(km).toString() : km.toFixed(1).replace(".", ",");
  return `${value} km`;
}
