// Formats a distance for display next to a trail or hike: metres round to the nearest
// 10, kilometres drop their decimal from 10 km up.

export function formatDistanceKm(km: number): string {
  const meters = Math.round((km * 1000) / 10) * 10;

  if (meters < 1000) return `${meters} m`;

  const value = km >= 10 ? Math.round(km).toString() : km.toFixed(1).replace(".", ",");
  return `${value} km`;
}
