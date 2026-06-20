import { pointFeatureFromPosition } from "@/utils/geojson";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useMemo } from "react";
import { START_MARKER_COLORS } from "./marker-styles";

interface Props {
  // Unique id prefix for this marker's source/layers within its map.
  id: string;
  position: GeoJSON.Position;
  label: string;
  // When provided, the marker becomes tappable (e.g. to open directions) and an
  // invisible, finger-sized hit circle is added so the small dot is easy to hit.
  onPress?: () => void;
}

// The route's start point (trailhead) drawn as GeoJSON layers — a circle, a halo
// ring, and a label — never a view-hosted <Marker>. View annotations are the most
// fragile path on iOS under the New Architecture (Fabric), so this stays on the
// same layer pipeline as the route. Colours come from the fixed light palette
// (the basemap is always light, even in the app's dark mode).
export default function StartMarker({ id, position, label, onPress }: Props) {
  const shape = useMemo(() => pointFeatureFromPosition(position), [position]);

  return (
    <GeoJSONSource id={id} data={shape} onPress={onPress}>
      {onPress && (
        <Layer
          type="circle"
          id={`${id}-hit`}
          paint={{ "circle-color": START_MARKER_COLORS.fill, "circle-opacity": 0, "circle-radius": 22 }}
        />
      )}
      <Layer
        type="circle"
        id={`${id}-point`}
        paint={{
          "circle-color": START_MARKER_COLORS.fill,
          "circle-radius": 7,
          "circle-stroke-width": 3,
          "circle-stroke-color": START_MARKER_COLORS.stroke,
        }}
      />
      <Layer
        type="symbol"
        id={`${id}-label`}
        layout={{
          "text-field": label,
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
          "text-anchor": "bottom",
          "text-offset": [0, -1],
          "text-allow-overlap": true,
        }}
        paint={{
          "text-color": START_MARKER_COLORS.fill,
          "text-halo-color": START_MARKER_COLORS.stroke,
          "text-halo-width": 1.5,
        }}
      />
    </GeoJSONSource>
  );
}
