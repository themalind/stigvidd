import CenterOnUserButton from "@/components/map/center-on-user-button";
import TrailMarkersMap from "@/components/map/trail-markers-map";
import { START_COORDINATE_BORAS } from "@/constants/constants";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView from "react-native-maps";
import { useTheme } from "react-native-paper";

export default function MapScreen() {
  const theme = useTheme();
  const [isMapReady, setIsMapReady] = useState(false);
  const mapRef = useRef<MapView>(null);

  return (
    <View style={s.container}>
      <TrailMarkersMap
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={START_COORDINATE_BORAS}
        showsUserLocation
        onMapReady={() => setIsMapReady(true)}
      />
      {!isMapReady && <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }]} />}

      <CenterOnUserButton mapRef={mapRef} />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
});
