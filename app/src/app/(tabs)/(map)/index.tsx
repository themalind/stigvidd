import CenterOnUserButton from "@/components/map/center-on-user-button";
import MapFilterMenu from "@/components/map/map-filter-menu";
import TrailCardCarousel from "@/components/map/trail-card-carousel";
import TrailMarkersMap from "@/components/map/trail-markers-map";
import { SCREEN_PADDING } from "@/constants/constants";
import { MapMarkerFilter } from "@/data/types";
import { guardedNavigate } from "@/utils/navigation";
import { type CameraRef } from "@maplibre/maplibre-react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { startTransition, useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "react-native-paper";

export default function MapScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const cameraRef = useRef<CameraRef>(null);

  const [isMapReady, setIsMapReady] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [filters, setFilters] = useState<MapMarkerFilter>({
    trails: true,
    shelters: false,
    firePits: false,
    accessibility: false,
  });
  const [carouselIds, setCarouselIds] = useState<string[] | null>(null);

  const handleMapReady = useCallback(() => setIsMapReady(true), []);

  const showOnMap = useCallback(
    (identifier: string) => {
      guardedNavigate(() =>
        router.navigate({
          pathname: "/(tabs)/(map)/follow/[identifier]",
          params: { identifier },
        }),
      );
    },
    [router],
  );

  const readMore = useCallback(
    (identifier: string) => {
      guardedNavigate(() =>
        router.navigate({
          pathname: "/(tabs)/(map)/trail/[identifier]",
          params: { identifier },
        }),
      );
    },
    [router],
  );

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => startTransition(() => setIsFocused(false));
    }, []),
  );

  return (
    <View style={s.container}>
      {isFocused && (
        <TrailMarkersMap
          filter={filters}
          style={StyleSheet.absoluteFill}
          cameraRef={cameraRef}
          onClusterOpen={setCarouselIds}
          onMapPress={() => setCarouselIds(null)}
          onMapReady={handleMapReady}
        />
      )}
      {(!isMapReady || !isFocused) && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }]} />
      )}

      <View style={[s.topBar, { top: insets.top + 8 }]}>
        <MapFilterMenu filter={filters} onChange={setFilters} />
      </View>

      {!carouselIds && <CenterOnUserButton cameraRef={cameraRef} />}

      {carouselIds && (
        <TrailCardCarousel
          identifiers={carouselIds}
          onClose={() => setCarouselIds(null)}
          onReadMore={readMore}
          onShowOnMap={showOnMap}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    position: "absolute",
    right: SCREEN_PADDING,
  },
});
