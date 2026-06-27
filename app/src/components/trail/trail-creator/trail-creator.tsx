import AlertDialog from "@/components/alert-dialog";
import LoadingIndicator from "@/components/loading-indicator";
import Map from "@/components/map/map";
import { ROUTE_LINE_COLOR } from "@/components/map/marker-styles";
import { BORDER_RADIUS, START_COORDINATE_BORAS } from "@/constants/constants";
import { dismissRecordingInfo, shouldShowRecordingInfo } from "@/services/location-task";
import { useLocationTracking } from "@/services/use-location-tracking";
import { lineStringFromPositions } from "@/utils/geojson";
import FormattedTime from "@/utils/format-time-from-ms";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Camera, type CameraRef, GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import RecordingInfoDialog from "./recording-info-dialog";
import SaveHikeModal from "./save-hike-modal";

// Map center used until a real position is available — keeps the map from
// rendering over the ocean while the first GPS fix resolves.
const FALLBACK_CENTER: [number, number] = [START_COORDINATE_BORAS.longitude, START_COORDINATE_BORAS.latitude];

export default function TrailCreator() {
  const cameraRef = useRef<CameraRef>(null);
  const { startTracking, stopTracking, resetTracking, isTracking, hike, currentSegment, getActiveTime } =
    useLocationTracking();

  const [displayTime, setDisplayTime] = useState(0);
  const getActiveTimeRef = useRef(getActiveTime);
  getActiveTimeRef.current = getActiveTime;

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  // Pre-start info dialog that gates the first start.
  const [showStartInfo, setShowStartInfo] = useState(false);
  const [initialCenter, setInitialCenter] = useState<[number, number] | undefined>(undefined);
  const theme = useTheme();
  const { t } = useTranslation();

  const routePositions = useMemo<[number, number][]>(() => {
    const finished = hike.segments.flatMap((segment) =>
      segment.coordinates.map((l) => [l.data.longitude, l.data.latitude] as [number, number]),
    );
    const current = currentSegment
      ? currentSegment.coordinates.map((l) => [l.data.longitude, l.data.latitude] as [number, number])
      : [];
    return [...finished, ...current];
  }, [hike.segments, currentSegment]);

  const routeShape = useMemo(() => lineStringFromPositions(routePositions), [routePositions]);

  // Kept in a ref so the one-shot load effect can read the latest route without
  // re-running when points come in.
  const routePositionsRef = useRef(routePositions);
  routePositionsRef.current = routePositions;

  useEffect(() => {
    if (!isTracking) {
      setDisplayTime(getActiveTimeRef.current());
      return;
    }

    const interval = setInterval(() => {
      setDisplayTime(getActiveTimeRef.current());
    }, 1000);

    return () => clearInterval(interval);
  }, [isTracking, hike.totalTime]);

  const formattedTime = FormattedTime(displayTime);

  const formattedDistance = useMemo(() => {
    const km = hike.totalDistance / 1000;
    return `${km.toFixed(2)} km`;
  }, [hike.totalDistance]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      // Render the map immediately from the cached last-known position (instant,
      // no GPS lock) — or a fallback center — instead of blocking on a cold fix.
      const last = status === "granted" ? await Location.getLastKnownPositionAsync() : null;
      if (cancelled) return;
      setInitialCenter(last ? [last.coords.longitude, last.coords.latitude] : FALLBACK_CENTER);

      if (status !== "granted") return;

      // Refine with a precise fix in the background and nudge the camera there,
      // unless the user has already started moving (then the route drives it).
      try {
        const precise = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled || routePositionsRef.current.length > 0) return;
        cameraRef.current?.easeTo({
          center: [precise.coords.longitude, precise.coords.latitude],
          zoom: 16,
          duration: 500,
        });
      } catch {
        // Keep the last-known / fallback center if the precise fix never arrives.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartPress = async () => {
    if (await shouldShowRecordingInfo()) {
      setShowStartInfo(true);
      return;
    }
    startTracking();
  };

  const handleConfirmStart = async (dontShowAgain: boolean) => {
    setShowStartInfo(false);
    if (dontShowAgain) await dismissRecordingInfo();
    startTracking();
  };

  useEffect(() => {
    const last = routePositions.at(-1);
    if (!last) return;
    cameraRef.current?.easeTo({ center: last, zoom: 17, duration: 500 });
  }, [routePositions]);

  const hasData = hike.segments.length > 0 || (currentSegment && currentSegment.coordinates.length > 0);

  if (!initialCenter) return <LoadingIndicator />;

  return (
    <View style={s.container}>
      <View style={s.mapContainer}>
        <Map style={s.map} showsUserLocation>
          <Camera ref={cameraRef} initialViewState={{ center: initialCenter, zoom: 16 }} />
          {/* A LineString needs >= 2 points; while tracking starts (0–1 nodes) the line isn't drawn yet. */}
          {routePositions.length > 1 && (
            <GeoJSONSource id="hike-route" data={routeShape}>
              <Layer
                type="line"
                id="hike-route-line"
                layout={{ "line-join": "round", "line-cap": "round" }}
                paint={{ "line-color": ROUTE_LINE_COLOR, "line-width": 4 }}
              />
            </GeoJSONSource>
          )}
        </Map>
      </View>

      <View style={[s.statsCard, { backgroundColor: theme.colors.outlineVariant }]}>
        <View style={s.statItem}>
          <Text style={s.statLabel}>Tid</Text>
          <Text style={s.statValue}>{formattedTime}</Text>
        </View>
        <View style={[s.statDivider, { backgroundColor: theme.colors.outline }]} />
        <View style={s.statItem}>
          <Text style={s.statLabel}>Distans</Text>
          <Text style={s.statValue}>{formattedDistance}</Text>
        </View>
      </View>

      <View style={s.actions}>
        {isTracking ? (
          <Pressable style={[s.actionButton, { backgroundColor: theme.colors.surface }]} onPress={() => stopTracking()}>
            <Ionicons name="pause" size={28} color={theme.colors.onSurface} />
            <Text style={s.buttonText}>Pausa</Text>
          </Pressable>
        ) : !hasData ? (
          <Pressable style={[s.actionButton, { backgroundColor: theme.colors.primary }]} onPress={handleStartPress}>
            <MaterialIcons name="hiking" size={28} color={theme.colors.onPrimary} />
            <Text style={[s.buttonText, { color: theme.colors.onPrimary }]}>{t("createHike.start")}</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={[s.actionButton, { backgroundColor: theme.colors.outlineVariant }]}
              onPress={() => setShowDeleteDialog(true)}
            >
              <MaterialIcons name="close" size={28} color={theme.colors.error} />
              <Text style={s.buttonText}>{t("createHike.reset")}</Text>
            </Pressable>
            <Pressable
              style={[s.actionButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowSaveModal(true)}
            >
              <MaterialIcons name="save" size={28} color={theme.colors.onPrimary} />
              <Text style={[s.buttonText, { color: theme.colors.onPrimary }]}>{t("common.save")}</Text>
            </Pressable>
            <Pressable
              style={[s.actionButton, { backgroundColor: theme.colors.outlineVariant }]}
              onPress={() => startTracking()}
            >
              <MaterialIcons name="play-arrow" size={28} color={theme.colors.onSurface} />
              <Text style={[s.buttonText, { color: theme.colors.onSurface }]}>{t("createHike.resume")}</Text>
            </Pressable>
          </>
        )}
      </View>

      <AlertDialog
        visible={showDeleteDialog}
        onDismiss={() => setShowDeleteDialog(false)}
        onConfirm={() => {
          setDisplayTime(0);
          resetTracking();
          setShowDeleteDialog(false);
        }}
        title={t("createHike.cancelTitle")}
        infoText={[t("createHike.cancelConfirm"), t("createHike.cancelWarning")]}
        backgroundColor={theme.colors.background}
        textColor={theme.colors.onBackground}
        cancelText={t("createHike.no")}
        confirmText={t("createHike.yes")}
      />

      <SaveHikeModal
        visible={showSaveModal}
        onDismiss={() => setShowSaveModal(false)}
        onConfirm={() => setShowSaveModal(false)}
        onSaveSuccess={resetTracking}
        hike={hike}
      />

      <RecordingInfoDialog
        visible={showStartInfo}
        onDismiss={() => setShowStartInfo(false)}
        onStart={handleConfirmStart}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10,
  },
  map: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  statsCard: {
    flexDirection: "row",
    borderRadius: BORDER_RADIUS,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  statValue: {
    fontSize: 32,
  },
  statDivider: {
    width: 1,
    marginVertical: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexBasis: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BORDER_RADIUS,
    gap: 8,
    height: 60,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
