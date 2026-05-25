import CenterOnUserButton from "@/components/map/center-on-user-button";
import FilterButton from "@/components/map/filter-button";
import TrailMarkersMap from "@/components/map/trail-markers-map";
import { START_COORDINATE_BORAS } from "@/constants/constants";
import { MapMarkerFilter, TrailPathResponse } from "@/data/types";
import { classificationParser } from "@/utils/classification-parser";
import { getDifficultyIcon } from "@/utils/getDifficultyIcon";
import { MaterialIcons } from "@expo/vector-icons";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import MapView from "react-native-maps";
import { Text, useTheme } from "react-native-paper";

export default function MapScreen() {
  const theme = useTheme();
  const [isMapReady, setIsMapReady] = useState(false);
  const mapRef = useRef<MapView>(null);
  const [filters, setFilters] = useState<MapMarkerFilter>({
    trails: true,
    shelters: false,
    firePits: false,
    accessibility: false,
  });
  const [selectedTrail, setSelectedTrail] = useState<TrailPathResponse | null>(null);
  const handleMapReady = useCallback(() => setIsMapReady(true), []);

  return (
    <View style={s.container}>
      <TrailMarkersMap
        ref={mapRef}
        filter={filters}
        style={StyleSheet.absoluteFill}
        initialRegion={START_COORDINATE_BORAS}
        showsUserLocation
        selectedTrail={selectedTrail}
        onTrailSelect={setSelectedTrail}
        onMapReady={handleMapReady}
      />
      {!isMapReady && <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }]} />}

      <CenterOnUserButton mapRef={mapRef} />
      <FilterButton filter={filters} onChange={setFilters} />

      {selectedTrail && (
        <View style={[s.infoPanel, { backgroundColor: theme.colors.surface }]}>
          <View style={s.infoPanelHeader}>
            <Text style={s.trailName} numberOfLines={1}>
              {selectedTrail.name}
            </Text>
            <TouchableOpacity onPress={() => setSelectedTrail(null)}>
              <MaterialIcons name="close" size={20} color={theme.colors.onSurface} />
            </TouchableOpacity>
          </View>
          <View style={s.infoPanelRow}>
            {selectedTrail.trailLength != null && (
              <Text style={[s.infoText, { color: theme.colors.onSurfaceVariant }]}>
                {selectedTrail.trailLength} km
              </Text>
            )}
            <View style={s.difficultyRow}>
              {getDifficultyIcon(classificationParser(selectedTrail.classification ?? 0))}
              <Text style={[s.infoText, { color: theme.colors.onSurfaceVariant }]}>
                {classificationParser(selectedTrail.classification ?? 0)}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  infoPanel: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  infoPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trailName: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  infoPanelRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  difficultyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  infoText: {
    fontSize: 13,
  },
});
