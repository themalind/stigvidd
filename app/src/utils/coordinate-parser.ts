import { LatLng } from "react-native-maps";

interface Props {
  data: string;
  identifier: string;
}

export default function CoordinateParser({ data, identifier }: Props): LatLng[] {
  try {
    return JSON.parse(data);
  } catch (error) {
    console.warn("Failed to parse coordinates for " + identifier, error);
    return [];
  }
}
