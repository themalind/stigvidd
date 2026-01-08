import { Trail } from "@/data/types";
import { Dimensions, StyleSheet } from "react-native";
import Map from "../map/map";
import { Surface } from "react-native-paper";
import MapView, { LatLng, Polyline } from "react-native-maps";
import { useEffect, useRef } from "react";

interface TrailMapProps {
  trail: Trail;
}

const WIDTH = Dimensions.get("screen").width;
const HEIGHT = Dimensions.get("screen").height;

export default function TrailMap({ trail }: TrailMapProps) {
  const mapRef = useRef<MapView>(null);
  const initialPadding = 60;

  const trailCoordinates: LatLng[] = mock;

  useEffect(() => {
  if (!mapRef.current || trailCoordinates.length === 0) return;

  mapRef.current.fitToCoordinates(trailCoordinates, {
    edgePadding: {
      top: initialPadding,
      right: initialPadding,
      bottom: initialPadding,
      left: initialPadding,
    },
    animated: true,
  });
}, [trailCoordinates]);

  return (
    <Surface style={s.container}>
      <Map style={s.map} ref={mapRef}>
        <Polyline
          coordinates={trailCoordinates}
          strokeWidth={3}
          strokeColor="#eb3204"
        />
      </Map>
    </Surface>
  );
}

const s = StyleSheet.create({
  container: {
    width: WIDTH * 0.9,
    height: HEIGHT * 0.3,
    borderRadius: 20,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
});

const mock: LatLng[] = [
  { latitude: 57.7300, longitude: 12.7030 },
  { latitude: 57.7300, longitude: 12.7020 },
  { latitude: 57.7310, longitude: 12.7020 },
  { latitude: 57.7310, longitude: 12.7010 },
  { latitude: 57.7300, longitude: 12.7010 },
  { latitude: 57.7300, longitude: 12.7000 },
  { latitude: 57.7325, longitude: 12.7000 },
  { latitude: 57.7325, longitude: 12.7010 },
  { latitude: 57.7315, longitude: 12.7010 },
  { latitude: 57.7315, longitude: 12.7020 },
  { latitude: 57.7325, longitude: 12.7020 },
  { latitude: 57.7325, longitude: 12.7030 },
  { latitude: 57.7300, longitude: 12.7030 },

  { latitude: 57.7300, longitude: 12.7045 },

  { latitude: 57.7325, longitude: 12.7045 },
  { latitude: 57.7325, longitude: 12.7075 },
  { latitude: 57.7320, longitude: 12.7075 },
  { latitude: 57.7320, longitude: 12.7055 },
  { latitude: 57.7315, longitude: 12.7055 },
  { latitude: 57.7315, longitude: 12.7075 },
  { latitude: 57.7310, longitude: 12.7075 },
  { latitude: 57.7310, longitude: 12.7055 },
  { latitude: 57.7305, longitude: 12.7055 },
  { latitude: 57.7305, longitude: 12.7075 },
  { latitude: 57.7300, longitude: 12.7075 },
  { latitude: 57.7300, longitude: 12.7045 },
  { latitude: 57.7300, longitude: 12.7075 },

  { latitude: 57.7300, longitude: 12.7090 },
  
  { latitude: 57.7325, longitude: 12.7090 },
  { latitude: 57.7325, longitude: 12.7100 },
  { latitude: 57.7305, longitude: 12.7100 },
  { latitude: 57.7305, longitude: 12.7120 },
  { latitude: 57.7300, longitude: 12.7120 },
  { latitude: 57.7300, longitude: 12.7090 },
  
  { latitude: 57.7300, longitude: 12.7135 },
  
  { latitude: 57.7325, longitude: 12.7135 },
  { latitude: 57.7325, longitude: 12.7165 },
  { latitude: 57.7310, longitude: 12.7165 },
  { latitude: 57.7310, longitude: 12.7145 },
  { latitude: 57.7320, longitude: 12.7145 },
  { latitude: 57.7320, longitude: 12.7155 },
  { latitude: 57.7315, longitude: 12.7155 },
  { latitude: 57.7315, longitude: 12.7145 },
  { latitude: 57.7300, longitude: 12.7145 },
  { latitude: 57.7300, longitude: 12.7135 },
];