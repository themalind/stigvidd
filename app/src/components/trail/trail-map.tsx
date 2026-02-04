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

  const getRegionFromTrail = (coords: LatLng[]) => {
    let minLat = coords[0].latitude;
    let maxLat = coords[0].latitude;
    let minLng = coords[0].longitude;
    let maxLng = coords[0].longitude;

    coords.forEach((c) => {
      minLat = Math.min(minLat, c.latitude);
      maxLat = Math.max(maxLat, c.latitude);
      minLng = Math.min(minLng, c.longitude);
      maxLng = Math.max(maxLng, c.longitude);
    });

    const latDelta = Math.max(maxLat - minLat, 0.01);
    const lngDelta = Math.max(maxLng - minLng, 0.01);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta * 1.6,
      longitudeDelta: lngDelta * 1.6,
    };
  };

  useEffect(() => {
    if (!mapRef.current || trail.length === 0) return;

    mapRef.current.animateToRegion(getRegionFromTrail(trail), 500);
  }, [trail]);

  return (
    <Surface style={s.container}>
      <Map style={s.map} ref={mapRef} initialRegion={getRegionFromTrail(trail)}>
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
