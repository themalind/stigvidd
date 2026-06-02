import CenterOnUserButton from "@/components/map/center-on-user-button";
import FilterButton from "@/components/map/filter-button";
import TrailMarkersMap from "@/components/map/trail-markers-map";
import { ELEVATION_SHADOW, START_COORDINATE_BORAS } from "@/constants/constants";
import { MapMarkerFilter } from "@/data/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTrailCard } from "@/hooks/useTrailCard";
import { classificationParser } from "@/utils/classification-parser";
import { getDifficultyIcon } from "@/utils/getDifficultyIcon";
import { guardedNavigate } from "@/utils/navigation";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Image } from "expo-image";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import MapView from "react-native-maps";
import { Text, useTheme } from "react-native-paper";

export default function MapScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { top: topInset } = useSafeAreaInsets();
  const [isMapReady, setIsMapReady] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const mapRef = useRef<MapView>(null);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );

  const [filters, setFilters] = useState<MapMarkerFilter>({
    trails: true,
    shelters: false,
    firePits: false,
    accessibility: false,
  });
  const [selectedIdentifier, setSelectedIdentifier] = useState<string | null>(null);
  const { card, isLoading } = useTrailCard(selectedIdentifier);

  const handleMapReady = useCallback(() => setIsMapReady(true), []);

  return (
    <View style={s.container}>
      <TrailMarkersMap
        ref={mapRef}
        isFocused={isFocused}
        filter={filters}
        style={StyleSheet.absoluteFill}
        initialRegion={START_COORDINATE_BORAS}
        showsUserLocation
        selectedIdentifier={selectedIdentifier}
        onTrailSelect={setSelectedIdentifier}
        onMapReady={handleMapReady}
      />
      {(!isMapReady || !isFocused) && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }]} />
      )}

      <CenterOnUserButton mapRef={mapRef} />
      <FilterButton filter={filters} onChange={setFilters} />

      {selectedIdentifier && (
        <View style={[s.infoPanel, { backgroundColor: theme.colors.surface, top: topInset + 16 }]}>
          {isLoading ? (
            <ActivityIndicator style={s.loader} color={theme.colors.primary} />
          ) : card ? (
            <>
              <View style={s.infoPanelHeader}>
                {card.image && (
                  <Image
                    source={card.image.imageUrl}
                    style={s.trailImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                )}
                <View style={s.infoPanelMeta}>
                  <Text style={s.trailName} numberOfLines={1}>
                    {card.name}
                  </Text>
                  <View style={s.infoRow}>
                    {card.trailLength != null && (
                      <Text style={[s.infoText, { color: theme.colors.onSurfaceVariant }]}>{card.trailLength} km</Text>
                    )}
                    <View style={s.difficultyRow}>
                      {getDifficultyIcon(classificationParser(card.classification ?? 0))}
                      <Text style={[s.infoText, { color: theme.colors.onSurfaceVariant }]}>
                        {classificationParser(card.classification ?? 0)}
                      </Text>
                    </View>
                    <Text style={[s.infoText, { color: theme.colors.onSurfaceVariant }]}>
                      {Number(card.averageRating) > 0 ? `★ ${Number(card.averageRating).toFixed(1)}` : "Inga betyg"}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => setSelectedIdentifier(null)} style={s.closeButton}>
                  <MaterialIcons name="close" size={20} color={theme.colors.onSurface} />
                </Pressable>
              </View>
              <Pressable
                style={[s.readMoreButton, { backgroundColor: theme.colors.primaryContainer }]}
                onPress={() =>
                  guardedNavigate(() =>
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    router.navigate({
                      pathname: "/(tabs)/(map)/trail/[identifier]" as any,
                      params: { identifier: selectedIdentifier },
                    }),
                  )
                }
              >
                <Text style={[s.readMoreText, { color: theme.colors.onPrimaryContainer }]}>Läs mer</Text>
                <MaterialIcons name="arrow-forward" size={16} color={theme.colors.onPrimaryContainer} />
              </Pressable>
            </>
          ) : null}
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
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    ...ELEVATION_SHADOW,
  },
  loader: {
    paddingVertical: 8,
  },
  infoPanelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  trailImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
    flexShrink: 0,
  },
  infoPanelMeta: {
    flex: 1,
    gap: 4,
  },
  trailName: {
    fontSize: 15,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    gap: 10,
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
  closeButton: {
    paddingLeft: 4,
  },
  readMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  readMoreText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
