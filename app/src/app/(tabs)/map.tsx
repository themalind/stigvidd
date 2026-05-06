import CenterOnUserButton from "@/components/map/center-on-user-button";
import FilterButton from "@/components/map/filter-button";
import TrailMarkersMap from "@/components/map/trail-markers-map";
import { START_COORDINATE_BORAS } from "@/constants/constants";
import { MapMarkerFilter } from "@/data/types";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView from "react-native-maps";
import { useTheme } from "react-native-paper";

export default function MapScreen() {
  const theme = useTheme();
  const [isMapReady, setIsMapReady] = useState(false);
  const mapRef = useRef<MapView>(null);
  const [filters, setFilters] = useState<MapMarkerFilter>({
    trails: true,
    shelters: true,
    firePits: true,
    accessibility: false,
  });

  return (
    <View style={s.container}>
      <TrailMarkersMap
        ref={mapRef}
        filter={filters}
        style={StyleSheet.absoluteFill}
        initialRegion={START_COORDINATE_BORAS}
        showsUserLocation
        onMapReady={() => setIsMapReady(true)}
      />
      {!isMapReady && <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }]} />}

      <CenterOnUserButton mapRef={mapRef} />
      <FilterButton filter={filters} onChange={setFilters} />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
});
