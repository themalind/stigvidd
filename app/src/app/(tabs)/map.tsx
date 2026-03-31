import TrailMarkersMap from "@/components/map/trail-markers-map";
import { START_COORDINATE_BORAS } from "@/constants/constants";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";

export default function MapScreen() {
  const theme = useTheme();
  const [isMapReady, setIsMapReady] = useState(false);

  return (
    <View style={s.container}>
      <TrailMarkersMap
        style={StyleSheet.absoluteFill}
        initialRegion={START_COORDINATE_BORAS}
        showsUserLocation
        onMapReady={() => setIsMapReady(true)}
      />
      {!isMapReady && <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }]} />}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
});
