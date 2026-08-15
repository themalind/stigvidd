import CenterOnUserButton from "@/components/map/center-on-user-button";
import Map from "@/components/map/map";
import { ROUTE_LINE_COLOR } from "@/components/map/marker-styles";
import StartMarker from "@/components/map/start-marker";
import UserLocationMarker from "@/components/map/user-location-marker";
import { SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { useLiveUserLocation } from "@/hooks/useLiveUserLocation";
import { lineStringFromPositions } from "@/utils/geojson";
import getBoundsFromTrail from "@/utils/get-bounds-from-trail";
import { openDirectionsToStart } from "@/utils/open-directions";
import { MaterialIcons } from "@expo/vector-icons";
import { Camera, type CameraRef, GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";

// The fullscreen "follow" view: one route drawn cleanly with the user's live position,
// nothing else (no clusters, other trails or facility pins). Shared by the trail follow
// screen and the hike follow screen so the two can't drift apart visually — each of
// those owns only its own data fetching and passes the finished path in here.
const FIT_PADDING = { top: 100, right: 60, bottom: 120, left: 60 };
// Zoom used when a route has a single point, where bounds are a zero-area box.
const SINGLE_POINT_ZOOM = 15;

interface Props {
  // Unique prefix for this view's map source/layer ids.
  idPrefix: string;
  // The route to walk, as [longitude, latitude] positions.
  path: GeoJSON.Position[];
  // Shown in the pill beside the back button.
  title?: string;
  isLoading?: boolean;
  // Shown centred when the route could not be loaded. Mutually exclusive with isLoading.
  errorMessage?: string;
}

export default function RouteFollowView({ idPrefix, path, title, isLoading, errorMessage }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const cameraRef = useRef<CameraRef>(null);
  const mapReadyRef = useRef(false);

  // The puck is driven by the app's own location watcher, not MapLibre's built-in
  // engine (which froze the dot mid-walk on both platforms — see the hook).
  const userLocation = useLiveUserLocation();

  const lineShape = useMemo(() => lineStringFromPositions(path), [path]);
  const bounds = useMemo(() => getBoundsFromTrail(path), [path]);

  const lineLayerId = `${idPrefix}-route-line`;
  // The layer the puck is pinned above — but only once that layer actually exists. The
  // route is rendered conditionally below, and the GPS fix usually lands before the
  // coordinates do, so naming an anchor unconditionally would leave the puck waiting on
  // a layer that might never appear.
  //
  // Anchor to the start marker's *label* (its topmost layer), not the route line: the
  // marker is mounted after the line, so it ends up above it, and anchoring to the line
  // left the puck buried under the trailhead circle. That is easy to miss on a trail but
  // obvious on a hike, where you're standing on the start point when you set off. A
  // one-point route still has a marker, so this covers that case too.
  const puckAnchor = path.length > 0 ? `${idPrefix}-start-label` : undefined;

  // Tapping the trailhead hands off to the device's maps app for directions.
  const openDirections = useCallback(() => {
    if (path.length > 0) openDirectionsToStart(path[0], t);
  }, [path, t]);

  // Fit to the route once both the map and the coordinates are ready — whichever
  // arrives last triggers the fit (map-ready callback, or this effect on bounds).
  const fitToRoute = useCallback(() => {
    if (!mapReadyRef.current) return;
    // A single point has a zero-area bounding box, which fitBounds resolves to maximum
    // zoom; centre on it at a sane level instead.
    if (path.length === 1) cameraRef.current?.jumpTo({ center: path[0] as [number, number], zoom: SINGLE_POINT_ZOOM });
    else if (bounds) cameraRef.current?.fitBounds(bounds, { padding: FIT_PADDING, duration: 0 });
  }, [bounds, path]);

  const handleMapReady = useCallback(() => {
    mapReadyRef.current = true;
    fitToRoute();
  }, [fitToRoute]);

  useEffect(() => {
    fitToRoute();
  }, [fitToRoute]);

  return (
    <View style={s.container}>
      <Map style={StyleSheet.absoluteFill} showsUserLocation={false} onDidFinishLoadingMap={handleMapReady}>
        <Camera ref={cameraRef} />
        {path.length > 1 && (
          <GeoJSONSource id={`${idPrefix}-route`} data={lineShape}>
            <Layer
              type="line"
              id={lineLayerId}
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": ROUTE_LINE_COLOR, "line-width": 5 }}
            />
          </GeoJSONSource>
        )}
        {path.length > 0 && (
          <StartMarker id={`${idPrefix}-start`} position={path[0]} label={t("map.start")} onPress={openDirections} />
        )}
        {userLocation && (
          <UserLocationMarker
            // Remount instead of mutating when the anchor appears. Changing
            // aboveLayerId in place makes the native side remove the layer and re-add
            // the same object, and it dereferences the new anchor with `!!` — see the
            // prop's docs in UserLocationMarker.
            key={puckAnchor ?? "no-anchor"}
            id={`${idPrefix}-user`}
            position={userLocation.position}
            heading={userLocation.heading}
            aboveLayerId={puckAnchor}
          />
        )}
      </Map>

      {/* Back arrow and route name share one pill that hugs its text, so the map keeps
          as much of its top edge as possible. The whole chip goes back. No safe-area
          offset: the app header sits above the tab navigator and already clears it. */}
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
        style={[title ? s.backChip : s.iconButton, { backgroundColor: theme.colors.surface }]}
      >
        <MaterialIcons name="arrow-back" size={24} color={theme.colors.onSurface} />
        {title && (
          <Text style={[s.title, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {title}
          </Text>
        )}
      </Pressable>

      {isLoading && (
        <View style={s.centreOverlay} pointerEvents="none">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      )}

      {!isLoading && errorMessage && (
        <View style={s.centreOverlay} pointerEvents="none">
          <View style={[s.messagePill, { backgroundColor: theme.colors.surface }]}>
            <Text style={{ color: theme.colors.onSurface }}>{errorMessage}</Text>
          </View>
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
  backChip: {
    position: "absolute",
    top: SCREEN_PADDING,
    left: SURFACE_BORDER_RADIUS,
    // Long names truncate rather than push the chip across the map.
    maxWidth: "70%",
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 8,
    paddingRight: 16,
    borderRadius: 20,
  },
  iconButton: {
    position: "absolute",
    top: SCREEN_PADDING,
    left: SURFACE_BORDER_RADIUS,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flexShrink: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  centreOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  messagePill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
});
