import AlertDialog from "@/components/alert-dialog";
import LoadingIndicator from "@/components/loading-indicator";
import Map from "@/components/map/map";
import { BORDER_RADIUS } from "@/constants/constants";
import { useLocationTracking } from "@/services/use-location-tracking";
import FormattedTime from "@/utils/format-time-from-ms";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import MapView, { Polyline, Region } from "react-native-maps";
import { Text, useTheme } from "react-native-paper";
import SaveHikeModal from "./save-hike-modal";

export default function TrailCreator() {
  const mapRef = useRef<MapView>(null);
  const { startTracking, stopTracking, resetTracking, isTracking, hike, currentSegment, getActiveTime, debugAddPoint } =
    useLocationTracking();

  const [displayTime, setDisplayTime] = useState(0);
  const getActiveTimeRef = useRef(getActiveTime);
  getActiveTimeRef.current = getActiveTime;

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [initialRegion, setInitialRegion] = useState<Region | undefined>(undefined);
  const theme = useTheme();

  const polylineCoords = useMemo(() => {
    const finished = hike.segments.flatMap((segment) => segment.coordinates.map((locationData) => locationData.data));
    const current = currentSegment ? currentSegment.coordinates.map((locationData) => locationData.data) : [];
    return [...finished, ...current];
  }, [hike.segments, currentSegment]);

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

      setInitialRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    })();
  }, []);

  useEffect(() => {
    const last = polylineCoords.at(-1);
    if (!last || !mapRef.current) return;

    mapRef.current.animateCamera({ center: last, zoom: 17 }, { duration: 500 });
  }, [polylineCoords]);

  const hasData = hike.segments.length > 0 || (currentSegment && currentSegment.coordinates.length > 0);

  if (!initialRegion) return <LoadingIndicator />;

  return (
    <View style={s.container}>
      {__DEV__ && (
        <View style={s.debugBar}>
          <Text style={s.debugText}>
            {polylineCoords.length} noder, {hike.segments.length} segment
          </Text>
          <Pressable style={s.debugButton} onPress={() => debugAddPoint()}>
            <Text style={s.debugText}>+ Lägg till punkt</Text>
          </Pressable>
        </View>
      )}
      <View style={s.mapContainer}>
        <Map ref={mapRef} style={s.map} initialRegion={initialRegion} showsUserLocation>
          <Polyline coordinates={polylineCoords} strokeColor={theme.colors.primary} strokeWidth={4} />
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
            <Text style={[s.buttonText, { color: theme.colors.onPrimary }]}>Starta vandring</Text>
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
              <Text style={s.buttonText}>Nollställ</Text>
            </Pressable>
            <Pressable
              style={[s.actionButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowSaveModal(true)}
            >
              <MaterialIcons name="save" size={28} color={theme.colors.onPrimary} />
              <Text style={[s.buttonText, { color: theme.colors.onPrimary }]}>Spara</Text>
            </Pressable>
            <Pressable
              style={[s.actionButton, { backgroundColor: theme.colors.outlineVariant }]}
              onPress={() => startTracking()}
            >
              <MaterialIcons name="play-arrow" size={28} color={theme.colors.onSurface} />
              <Text style={[s.buttonText, { color: theme.colors.onSurface }]}>Återuppta</Text>
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
        title={"Avbryt pågående promenad"}
        infoText={["Vill du verkligen avbryta den pågående promenad?", "Detta går inte att ångra."]}
        backgroundColor={theme.colors.background}
        textColor={theme.colors.onBackground}
        cancelText={"Nej"}
        confirmText={"Ja"}
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
