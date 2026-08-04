/**
 * Mock images are recognized by their path: trails live under ".../trails/mock/..."
 * (e.g. "mock/gesebol/20250824100243.jpg", "mock/vindskydd_mock.jpg") and areas
 * use ".../trails/area-mock.jpg". They all live on stigvidd.se and contain "mock"
 * in the URL. Real uploaded images have no "mock", so the "Example image" badge
 * disappears automatically once they are replaced.
 *
 * Handles the source formats expo-image accepts: a string URL, a { uri } object,
 * or a local require (number) — where local requires are never mock.
 */
export function isMockImage(source: unknown): boolean {
  const uri =
    typeof source === "string"
      ? source
      : typeof source === "object" && source !== null && "uri" in source
        ? String((source as { uri?: unknown }).uri ?? "")
        : "";
  return uri.toLowerCase().includes("mock");
}
