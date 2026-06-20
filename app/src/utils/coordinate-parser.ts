interface Props {
  data: string;
  identifier: string;
}

interface RawCoordinate {
  latitude: number;
  longitude: number;
}

// Parses the backend coordinate string (a JSON array of { latitude, longitude })
// into GeoJSON positions ([longitude, latitude]). This is the single boundary
// where the wire format is mapped to the app's GeoJSON-native render model.
//
// Defensive on purpose: the payload is untrusted JSON, so a non-array shape or
// any point with a missing / non-finite coordinate is dropped rather than
// producing NaN positions that would later corrupt the route line and the
// computed camera bounds. Done in a single pass for large trails.
export default function CoordinateParser({ data, identifier }: Props): GeoJSON.Position[] {
  try {
    const raw: unknown = JSON.parse(data);

    if (!Array.isArray(raw)) {
      console.warn("Coordinates payload is not an array for " + identifier);
      return [];
    }

    const positions: GeoJSON.Position[] = [];
    for (const point of raw as readonly (Partial<RawCoordinate> | null)[]) {
      const lat = point?.latitude;
      const lng = point?.longitude;
      if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
        positions.push([lng, lat]);
      }
    }

    return positions;
  } catch (error) {
    console.warn("Failed to parse coordinates for " + identifier, error);
    return [];
  }
}
