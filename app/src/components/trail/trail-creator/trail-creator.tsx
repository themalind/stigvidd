import AlertDialog from "@/components/alert-dialog";
import LoadingIndicator from "@/components/loading-indicator";
import Map from "@/components/map/map";
import { BORDER_RADIUS } from "@/constants/constants";
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
import SaveHikeModal from "./save-hike-modal";

export default function TrailCreator() {
  const cameraRef = useRef<CameraRef>(null);
  const { startTracking, stopTracking, resetTracking, isTracking, hike, currentSegment, getActiveTime, debugAddPoint } =
    useLocationTracking();

  const [displayTime, setDisplayTime] = useState(0);
  const getActiveTimeRef = useRef(getActiveTime);
  getActiveTimeRef.current = getActiveTime;

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
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
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const location = await Location.getCurrentPositionAsync();
      setInitialCenter([location.coords.longitude, location.coords.latitude]);
    })();
  }, []);

  useEffect(() => {
    const last = routePositions.at(-1);
    if (!last) return;
    cameraRef.current?.easeTo({ center: last, zoom: 17, duration: 500 });
  }, [routePositions]);

  const hasData = hike.segments.length > 0 || (currentSegment && currentSegment.coordinates.length > 0);

  if (!initialCenter) return <LoadingIndicator />;

  return (
    <View style={s.container}>
      {__DEV__ && (
        <View style={s.debugBar}>
          <Text style={s.debugText}>
            {routePositions.length} noder, {hike.segments.length} segment
          </Text>
          <Pressable style={s.debugButton} onPress={() => debugAddPoint()}>
            <Text style={s.debugText}>+ Lägg till punkt</Text>
          </Pressable>
        </View>
      )}
      <View style={s.mapContainer}>
        <Map style={s.map} showsUserLocation>
          <Camera ref={cameraRef} initialViewState={{ center: initialCenter, zoom: 16 }} />
          <GeoJSONSource id="hike-route" data={routeShape}>
            <Layer
              type="line"
              id="hike-route-line"
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": theme.colors.primary, "line-width": 4 }}
            />
          </GeoJSONSource>
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
        {!hasData ? (
          <Pressable
            style={[s.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => startTracking()}
          >
            <MaterialIcons name="hiking" size={28} color={theme.colors.onPrimary} />
            <Text style={[s.buttonText, { color: theme.colors.onPrimary }]}>{t("createHike.start")}</Text>
          </Pressable>
        ) : isTracking ? (
          <Pressable style={[s.actionButton, { backgroundColor: theme.colors.surface }]} onPress={() => stopTracking()}>
            <Ionicons name="pause" size={28} color={theme.colors.onSurface} />
            <Text style={s.buttonText}>Pausa</Text>
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
  debugBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#a00",
    borderRadius: BORDER_RADIUS,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  debugButton: {
    padding: 4,
  },
  debugText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
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
