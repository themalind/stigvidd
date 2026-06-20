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
export default function CoordinateParser({ data, identifier }: Props): GeoJSON.Position[] {
  try {
    const raw = JSON.parse(data) as RawCoordinate[];
    return raw.map((c) => [c.longitude, c.latitude]);
  } catch (error) {
    console.warn("Failed to parse coordinates for " + identifier, error);
    return [];
  }
}
