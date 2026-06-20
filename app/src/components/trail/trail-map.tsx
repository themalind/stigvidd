import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { lineStringFromPositions, pointFeatureFromPosition } from "@/utils/geojson";
import getBoundsFromTrail from "@/utils/get-bounds-from-trail";
import { openDirectionsToStart } from "@/utils/open-directions";
import { MaterialIcons } from "@expo/vector-icons";
import { Camera, type CameraRef, GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useCallback, useMemo, useRef } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Surface, Text, useTheme } from "react-native-paper";
import Map from "../map/map";
import { ROUTE_LINE_COLOR, START_MARKER_COLORS } from "../map/marker-styles";

interface TrailMapProps {
  trail: GeoJSON.Position[];
  onPress: () => void;
}

const HEIGHT = Dimensions.get("screen").height;
// On narrow phones the two corner pills would crowd each other, so the directions
// pill drops its label and shows just the icon below this width (app is portrait-locked).
const COMPACT_DIRECTIONS = Dimensions.get("window").width < 380;

// Static map preview on the trail detail screen: shows the route and the user's
// position, but is not pannable — the whole surface is a button that opens the
// fullscreen follow view (the map itself is the entry point).
export default function TrailMap({ trail, onPress }: TrailMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const theme = useTheme();
  const { t } = useTranslation();

  const bounds = useMemo(() => getBoundsFromTrail(trail), [trail]);
  const center = useMemo<[number, number] | undefined>(
    () => (bounds ? [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2] : undefined),
    [bounds],
  );
  const lineShape = useMemo(() => lineStringFromPositions(trail), [trail]);
  // Draw the trailhead as a GeoJSON point layer (not a view-hosted <Marker>):
  // consistent with the rest of the map and avoids the fragile annotation path
  // on iOS + New Architecture.
  const startShape = useMemo(
    () => (trail.length > 0 ? pointFeatureFromPosition(trail[0]) : undefined),
    [trail],
  );

  const fitToTrail = useCallback(() => {
    if (bounds) cameraRef.current?.fitBounds(bounds, { padding: { top: 40, right: 40, bottom: 40, left: 40 }, duration: 0 });
  }, [bounds]);

  return (
    <Surface style={s.container}>
      <View style={s.inner}>
        {trail.length > 0 && (
          <Map
            style={s.map}
            showsUserLocation
            dragPan={false}
            touchZoom={false}
            touchRotate={false}
            touchPitch={false}
            doubleTapZoom={false}
            onDidFinishLoadingMap={fitToTrail}
          >
            <Camera ref={cameraRef} initialViewState={center ? { center, zoom: 12 } : undefined} />
            <GeoJSONSource id="trail-route" data={lineShape}>
              <Layer
                type="line"
                id="trail-route-line"
                layout={{ "line-join": "round", "line-cap": "round" }}
                paint={{ "line-color": ROUTE_LINE_COLOR, "line-width": 3 }}
              />
            </GeoJSONSource>
            {startShape && (
              <GeoJSONSource id="trail-start" data={startShape}>
                <Layer
                  type="circle"
                  id="trail-start-point"
                  paint={{
                    "circle-color": START_MARKER_COLORS.fill,
                    "circle-radius": 7,
                    "circle-stroke-width": 3,
                    "circle-stroke-color": START_MARKER_COLORS.stroke,
                  }}
                />
                <Layer
                  type="symbol"
                  id="trail-start-label"
                  layout={{
                    "text-field": t("map.start"),
                    "text-font": ["Noto Sans Regular"],
                    "text-size": 12,
                    "text-anchor": "bottom",
                    "text-offset": [0, -1],
                    "text-allow-overlap": true,
                  }}
                  paint={{
                    "text-color": START_MARKER_COLORS.fill,
                    "text-halo-color": START_MARKER_COLORS.stroke,
                    "text-halo-width": 1.5,
                  }}
                />
              </GeoJSONSource>
            )}
          </Map>
        )}
        <Pressable style={s.overlay} onPress={onPress}>
          <View style={[s.badge, { backgroundColor: theme.colors.surface }]}>
            <MaterialIcons name="open-in-full" size={16} color={theme.colors.onSurface} />
            <Text style={[s.badgeText, { color: theme.colors.onSurface }]}>{t("map.showOnMap")}</Text>
          </View>
        </Pressable>
        {/* Sits on top of the overlay so its tap opens directions instead of the
            follow view; rendered last to win the touch in its corner. */}
        {trail.length > 0 && (
          <Pressable
            style={[s.directions, { backgroundColor: theme.colors.surface }]}
            onPress={() => openDirectionsToStart(trail[0], t)}
            hitSlop={6}
            accessibilityLabel={t("map.directions")}
          >
            <MaterialIcons name="directions" size={16} color={theme.colors.onSurface} />
            {!COMPACT_DIRECTIONS && (
              <Text style={[s.badgeText, { color: theme.colors.onSurface }]}>{t("map.directions")}</Text>
            )}
          </Pressable>
        )}
      </View>
    </Surface>
  );
}

const s = StyleSheet.create({
  container: {
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    padding: 10,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    opacity: 0.95,
  },
  directions: {
    position: "absolute",
    left: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    opacity: 0.95,
  },
  badgeText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
