import { useEffect, useRef } from "react";
import { Dimensions, StyleSheet } from "react-native";
import MapView, { LatLng, Polyline } from "react-native-maps";
import { Surface } from "react-native-paper";
import Map from "../map/map";

interface TrailMapProps {
  trail: LatLng[];
}

const WIDTH = Dimensions.get("screen").width;
const HEIGHT = Dimensions.get("screen").height;

export default function TrailMap({ trail }: TrailMapProps) {
  const mapRef = useRef<MapView>(null);
  const initialPadding = 60;

  useEffect(() => {
    if (!mapRef.current || trail.length === 0) return;

    mapRef.current.fitToCoordinates(trail, {
      edgePadding: {
        top: initialPadding,
        right: initialPadding,
        bottom: initialPadding,
        left: initialPadding,
      },
      animated: true,
    });
  }, [trail]);

  return (
    <Surface style={s.container}>
      <Map style={s.map} ref={mapRef}>
        <Polyline coordinates={trail} strokeWidth={3} strokeColor="#eb3204" />
      </Map>
    </Surface>
  );
}

const s = StyleSheet.create({
  container: {
    width: WIDTH * 0.9,
    height: HEIGHT * 0.3,
    borderRadius: 10,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
});
