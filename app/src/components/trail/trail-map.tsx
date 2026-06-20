import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { lineStringFromPositions } from "@/utils/geojson";
import getBoundsFromTrail from "@/utils/get-bounds-from-trail";
import { MaterialIcons } from "@expo/vector-icons";
import { Camera, type CameraRef, GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useCallback, useMemo, useRef } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Surface, Text, useTheme } from "react-native-paper";
import Map from "../map/map";

interface TrailMapProps {
  trail: GeoJSON.Position[];
  onPress: () => void;
}

const HEIGHT = Dimensions.get("screen").height;

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
                paint={{ "line-color": theme.colors.primary, "line-width": 3 }}
              />
            </GeoJSONSource>
          </Map>
        )}
        <Pressable style={s.overlay} onPress={onPress}>
          <View style={[s.badge, { backgroundColor: theme.colors.surface }]}>
            <MaterialIcons name="open-in-full" size={16} color={theme.colors.onSurface} />
            <Text style={[s.badgeText, { color: theme.colors.onSurface }]}>{t("map.showOnMap")}</Text>
          </View>
        </Pressable>
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
  badgeText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
