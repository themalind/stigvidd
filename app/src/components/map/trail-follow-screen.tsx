import { getCoordinatesByTrailIdentifier } from "@/api/trails";
import { TRAIL_COORDINATES_STALE_TIME } from "@/constants/cache";
import CenterOnUserButton from "@/components/map/center-on-user-button";
import Map from "@/components/map/map";
import { ROUTE_LINE_COLOR } from "@/components/map/marker-styles";
import StartMarker from "@/components/map/start-marker";
import UserLocationMarker from "@/components/map/user-location-marker";
import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { useLiveUserLocation } from "@/hooks/useLiveUserLocation";
import { useTrailCard } from "@/hooks/useTrailCard";
import CoordinateParser from "@/utils/coordinate-parser";
import { lineStringFromPositions } from "@/utils/geojson";
import getBoundsFromTrail from "@/utils/get-bounds-from-trail";
import { openDirectionsToStart } from "@/utils/open-directions";
import { MaterialIcons } from "@expo/vector-icons";
import { Camera, type CameraRef, GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";

// Fullscreen "follow" view: a single trail's route drawn cleanly with the user's
// live position, nothing else (no clusters, other trails or facility pins). Reached
// from the carousel's "show on map" and by tapping the embedded map on a trail's
// detail screen. Pushed within the current stack, so back returns where you came from.
const FIT_PADDING = { top: 100, right: 60, bottom: 120, left: 60 };

export default function TrailFollowScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const cameraRef = useRef<CameraRef>(null);
  const mapReadyRef = useRef(false);

  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const normalizedIdentifier: string = Array.isArray(identifier) ? identifier[0] : identifier;

  const { card } = useTrailCard(normalizedIdentifier ?? null);

  // The puck is driven by the app's own location watcher, not MapLibre's built-in
  // engine (which froze the dot mid-walk on both platforms — see the hook).
  const userLocation = useLiveUserLocation();

  const { data: coords, isLoading } = useQuery({
    queryKey: ["cords", normalizedIdentifier],
    queryFn: () => getCoordinatesByTrailIdentifier(normalizedIdentifier),
    enabled: !!normalizedIdentifier,
    staleTime: TRAIL_COORDINATES_STALE_TIME,
  });

  const path = useMemo(
    () => (coords ? CoordinateParser({ data: coords.coordinates, identifier: normalizedIdentifier }) : []),
    [coords, normalizedIdentifier],
  );
  const lineShape = useMemo(() => lineStringFromPositions(path), [path]);
  const bounds = useMemo(() => getBoundsFromTrail(path), [path]);

  // Tapping the trailhead hands off to the device's maps app for directions.
  const openDirections = useCallback(() => {
    if (path.length > 0) openDirectionsToStart(path[0], t);
  }, [path, t]);

  // Fit to the trail once both the map and the coordinates are ready — whichever
  // arrives last triggers the fit (map-ready callback, or this effect on bounds).
  const fitToTrail = useCallback(() => {
    if (bounds && mapReadyRef.current) cameraRef.current?.fitBounds(bounds, { padding: FIT_PADDING, duration: 0 });
  }, [bounds]);

  const handleMapReady = useCallback(() => {
    mapReadyRef.current = true;
    fitToTrail();
  }, [fitToTrail]);

  useEffect(() => {
    fitToTrail();
  }, [fitToTrail]);

  return (
    <View style={s.container}>
      <Map style={StyleSheet.absoluteFill} showsUserLocation={false} onDidFinishLoadingMap={handleMapReady}>
        <Camera ref={cameraRef} />
        {path.length > 1 && (
          <GeoJSONSource id="follow-trail" data={lineShape}>
            <Layer
              type="line"
              id="follow-trail-line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": ROUTE_LINE_COLOR, "line-width": 5 }}
            />
          </GeoJSONSource>
        )}
        {path.length > 0 && (
          <StartMarker id="follow-start" position={path[0]} label={t("map.start")} onPress={openDirections} />
        )}
        {userLocation && (
          <UserLocationMarker
            id="follow-user"
            position={userLocation.position}
            heading={userLocation.heading}
            aboveLayerId="follow-trail-line"
          />
        )}
      </Map>

      <View style={[s.topRow, { top: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={[s.iconButton, { backgroundColor: theme.colors.surface }]}
        >
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.onSurface} />
        </Pressable>
        {card?.name && (
          <View style={[s.titlePill, { backgroundColor: theme.colors.surface }]}>
            <Text style={[s.title, { color: theme.colors.onSurface }]} numberOfLines={1}>
              {card.name}
            </Text>
          </View>
        )}
      </View>

      {isLoading && (
        <View style={s.loader} pointerEvents="none">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      )}

      <CenterOnUserButton cameraRef={cameraRef} position={userLocation?.position ?? null} />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  topRow: {
    position: "absolute",
    left: SURFACE_BORDER_RADIUS,
    right: SURFACE_BORDER_RADIUS,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  titlePill: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
