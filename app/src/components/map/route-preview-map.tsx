import Map from "@/components/map/map";
import MapPreviewOverlay from "@/components/map/map-preview-overlay";
import { ROUTE_LINE_COLOR } from "@/components/map/marker-styles";
import StartMarker from "@/components/map/start-marker";
import { SCREEN_PADDING } from "@/constants/constants";
import { lineStringFromPositions } from "@/utils/geojson";
import getBoundsFromTrail from "@/utils/get-bounds-from-trail";
import { openDirectionsToStart } from "@/utils/open-directions";
import { Camera, type CameraRef, GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useCallback, useMemo, useRef } from "react";
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";

// Zoom used when a route has a single point, where bounds are a zero-area box.
const SINGLE_POINT_ZOOM = 15;
// Turning the preview into a button means it can't also be panned — the full-cover
// Pressable would swallow the drag. Mirrors the trail detail screen, where the static
// map is itself the entry point to the fullscreen view.
const STATIC_GESTURES = {
  dragPan: false,
  touchZoom: false,
  touchRotate: false,
  touchPitch: false,
  doubleTapZoom: false,
} as const;

interface Props {
  // Unique prefix for this map's source/layer ids.
  idPrefix: string;
  path: GeoJSON.Position[];
  // When given, the preview becomes a button that opens the fullscreen follow view and
  // shows the "Visa kartvy" badge; the map stops being pannable in exchange. Omit it to
  // keep a plain, pannable read-only preview (used for shares awaiting a decision).
  onOpen?: () => void;
  // Overrides the badge text for previews that open something other than the map view.
  label?: string;
  // The directions pill needs room the home screen's small card doesn't have, and
  // getting there is not what that card is for.
  showDirections?: boolean;
  // Drops the visible chrome while keeping the press behaviour, for callers that draw
  // their own affordance over the map. The full-cover Pressable stays either way — the
  // map swallows touches, so without it the parent never sees the tap.
  showBadge?: boolean;
  style?: StyleProp<ViewStyle>;
}

// The small route map inside the hike and shared-hike detail modals: the recorded walk
// plus its start point, with no live user position (that's the fullscreen follow view's
// job). Shared by both modals, which otherwise carried an identical copy each.
export default function RoutePreviewMap({
  idPrefix,
  path,
  onOpen,
  label,
  showDirections = true,
  showBadge = true,
  style,
}: Props) {
  const cameraRef = useRef<CameraRef>(null);
  const { t } = useTranslation();

  const routeShape = useMemo(() => lineStringFromPositions(path), [path]);
  const bounds = useMemo(() => getBoundsFromTrail(path), [path]);

  const handleMapReady = useCallback(() => {
    // A single point has a zero-area bounding box, which fitBounds resolves to maximum
    // zoom; centre on it at a sane level instead.
    if (path.length === 1) cameraRef.current?.jumpTo({ center: path[0] as [number, number], zoom: SINGLE_POINT_ZOOM });
    else if (bounds)
      cameraRef.current?.fitBounds(bounds, { padding: { top: 20, right: 20, bottom: 20, left: 20 }, duration: 0 });
  }, [bounds, path]);

  return (
    <View style={style}>
      {path.length > 0 && (
        <Map
          style={s.map}
          showsUserLocation={false}
          // Top-left instead of the fullscreen default: the bottom corners hold the
          // overlay's two pills, and the safe-area inset has nothing to clear here.
          attributionPosition={{ top: SCREEN_PADDING, left: SCREEN_PADDING }}
          onDidFinishLoadingMap={handleMapReady}
          {...(onOpen ? STATIC_GESTURES : {})}
        >
          <Camera ref={cameraRef} />
          {path.length > 1 && (
            <GeoJSONSource id={`${idPrefix}-route`} data={routeShape}>
              <Layer
                type="line"
                id={`${idPrefix}-route-line`}
                layout={{ "line-join": "round", "line-cap": "round" }}
                paint={{ "line-color": ROUTE_LINE_COLOR, "line-width": 3 }}
              />
            </GeoJSONSource>
          )}
          <StartMarker
            id={`${idPrefix}-start`}
            position={path[0]}
            label={t("map.start")}
            // With the overlay mounted its pill owns directions instead — the
            // full-cover Pressable would swallow this tap anyway.
            onPress={onOpen ? undefined : () => openDirectionsToStart(path[0], t)}
          />
        </Map>
      )}
      {onOpen &&
        path.length > 0 &&
        (showBadge ? (
          <MapPreviewOverlay
            label={label ?? t("map.showMapView")}
            onPress={onOpen}
            startPosition={showDirections ? path[0] : undefined}
          />
        ) : (
          <Pressable style={StyleSheet.absoluteFill} onPress={onOpen} accessibilityRole="button" />
        ))}
    </View>
  );
}

const s = StyleSheet.create({
  map: {
    flex: 1,
  },
});
