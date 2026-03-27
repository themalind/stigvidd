import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import GetRegionFromTrail from "@/utils/get-region-from-trail";
import { useEffect, useRef } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
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

  useEffect(() => {
    if (!mapRef.current || trail.length === 0) return;

    mapRef.current.animateToRegion(GetRegionFromTrail(trail), 500);
  }, [trail]);

  return (
    <Surface style={s.container}>
      <View style={s.inner}>
        <Map style={s.map} ref={mapRef} initialRegion={GetRegionFromTrail(trail)}>
          <Polyline coordinates={trail} strokeWidth={3} strokeColor="#eb3204" />
        </Map>
      </View>
    </Surface>
  );
}

const s = StyleSheet.create({
  container: {
    width: WIDTH * 0.9,
    height: HEIGHT * 0.3,
    borderRadius: SURFACE_BORDER_RADIUS,
  },
  inner: {
    flex: 1,
    borderRadius: SURFACE_BORDER_RADIUS,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
});
