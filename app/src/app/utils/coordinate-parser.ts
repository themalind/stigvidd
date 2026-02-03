import { Coordinate } from "@/data/types";
import { LatLng } from "react-native-maps";

export default function CoordinateParser(data: string): LatLng[] {
  try {
    const json: Coordinate[] = JSON.parse(data);

    return json.map((coordinate) => ({
      latitude: coordinate.Latitude,
      longitude: coordinate.Longitude,
    }));
  } catch (error) {
    console.warn("Failed to parse coordinates", error);
    return [];
  }
}
