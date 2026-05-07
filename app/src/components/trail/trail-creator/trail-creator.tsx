import AlertDialog from "@/components/alert-dialog";
import LoadingIndicator from "@/components/loading-indicator";
import Map from "@/components/map/map";
import { BORDER_RADIUS } from "@/constants/constants";
import { useLocationTracking } from "@/services/use-location-tracking";
import FormattedTime from "@/utils/format-time-from-ms";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import MapView, { Polyline, Region } from "react-native-maps";
import { Text, useTheme } from "react-native-paper";
import SaveHikeModal from "./save-hike-modal";

export default function TrailCreator() {
  const mapRef = useRef<MapView>(null);
  const { startTracking, stopTracking, resetTracking, isTracking, hike, currentSegment, getActiveTime, debugAddPoint } =
    useLocationTracking();

  // Displayed time in ms, updated every second while tracking
  const [displayTime, setDisplayTime] = useState(0);
  // Ref so the interval callback always calls the latest version of getActiveTime
  const getActiveTimeRef = useRef(getActiveTime);
  getActiveTimeRef.current = getActiveTime;

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  // Set once on mount from the device's current GPS position
  const [initialRegion, setInitialRegion] = useState<Region | undefined>(undefined);
  const theme = useTheme();

  // Flattens all completed segments + the active segment into a single coordinate array for the polyline
  const polylineCoords = useMemo(() => {
    const finished = hike.segments.flatMap((segment) => segment.coordinates.map((locationData) => locationData.data));
    const current = currentSegment ? currentSegment.coordinates.map((locationData) => locationData.data) : [];
    return [...finished, ...current];
  }, [hike.segments, currentSegment]);

  // Ticks the displayed time every second while tracking; freezes it on pause
  useEffect(() => {
    if (!isTracking) {
      setDisplayTime(getActiveTimeRef.current());
      return;
    }

    const interval = setInterval(() => {
      setDisplayTime(getActiveTimeRef.current());
    }, 1000);

    return () => clearInterval(interval);
  }, [isTracking]);

  const formattedTime = FormattedTime(displayTime);

  // Converts totalDistance from meters to a "x.xx km" string
  const formattedDistance = useMemo(() => {
    const km = hike.totalDistance / 1000;
    return `${km.toFixed(2)} km`;
  }, [hike.totalDistance]);

  // On mount: fetch the user's current position to center the map before any tracking starts
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

  // Keep the map camera centered on the latest recorded point as the route grows
  useEffect(() => {
    const last = polylineCoords.at(-1);
    if (!last || !mapRef.current) return;

    mapRef.current.animateCamera(
      {
        center: last,
        zoom: 17,
      },
      { duration: 500 },
    );
  }, [polylineCoords]);

  // Controls which action buttons are shown:
  // no data → only "Start", tracking → only "Pause", paused with data → "Reset / Save / Resume"
  const hasData = hike.segments.length > 0 || (currentSegment && currentSegment.coordinates.length > 0);

  // Wait until we have the user's position before rendering the map
  if (!initialRegion) return <LoadingIndicator />;

  return (
    <ScrollView contentContainerStyle={s.content}>
      {/* Debug bar — shows node/segment counts and a button to inject fake GPS points */}
      <View style={s.debug}>
        <Text>
          debug: {polylineCoords.length} nodes, {hike.segments.length} segments
        </Text>

        <Pressable onPress={() => debugAddPoint()}>
          <Text>Add</Text>
        </Pressable>
      </View>

      <View style={s.mapContainer}>
        <Map ref={mapRef} style={s.map} initialRegion={initialRegion} showsUserLocation>
          {/* Draws the recorded route as a red line on the map */}
          <Polyline coordinates={polylineCoords} strokeColor="#ff0000" strokeWidth={4} />
        </Map>
      </View>

      {/* Elapsed time display */}
      <View style={[s.infoSection, { backgroundColor: theme.colors.surface }]}>
        <Text style={s.infoText}>{formattedTime}</Text>
      </View>

      {/* Total distance display */}
      <View style={[s.infoSection, { backgroundColor: theme.colors.surface }]}>
        <Text style={s.infoText}>{formattedDistance}</Text>
      </View>

      <View style={s.actions}>
        {!hasData ? (
          // No recording yet — show the start button
          <Pressable
            style={[s.actionButton, { backgroundColor: theme.colors.surface }]}
            onPress={() => startTracking()}
          >
            <Ionicons name="walk-outline" size={30} color={theme.colors.onSurface} />
            <Text style={{ color: theme.colors.onSurface }}>Starta vandring</Text>
          </Pressable>
        ) : isTracking ? (
          // Currently recording — only allow pausing
          <Pressable style={[s.actionButton, { backgroundColor: theme.colors.surface }]} onPress={() => stopTracking()}>
            <Ionicons name="pause" size={30} color={theme.colors.onSurface} />
          </Pressable>
        ) : (
          // Paused with data — allow reset, save, or resume
          <>
            <Pressable
              style={[s.actionButton, { backgroundColor: theme.colors.errorContainer }]}
              onPress={() => setShowDeleteDialog(true)}
            >
              <Ionicons name="close" size={30} color={theme.colors.onSurface} />
              <Text>Nollställ</Text>
            </Pressable>
            <Pressable
              style={[s.actionButton, { backgroundColor: theme.colors.inversePrimary }]}
              onPress={() => setShowSaveModal(true)}
            >
              <Ionicons name="checkmark-sharp" size={30} color={theme.colors.onSurface} />
              <Text>Spara</Text>
            </Pressable>
            <Pressable
              style={[s.actionButton, { backgroundColor: theme.colors.surface }]}
              onPress={() => startTracking()}
            >
              <Ionicons name="play" size={30} color={theme.colors.onSurface} />
              <Text>Återuppta</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Confirm dialog shown before wiping all recorded data */}
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

      {/* Modal where the user names and confirms saving the hike */}
      <SaveHikeModal
        visible={showSaveModal}
        onDismiss={() => setShowSaveModal(false)}
        onConfirm={() => setShowSaveModal(false)}
        onSaveSuccess={resetTracking}
        hike={hike}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  debug: {
    backgroundColor: "#a00",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 5,
  },
  content: {
    flex: 1,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 15,
  },
  map: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    minHeight: 200,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
    marginBottom: 20,
  },
  infoSection: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BORDER_RADIUS,
    height: 80,
    marginBottom: 5,
  },
  infoText: {
    fontSize: 40,
  },
  actions: {
    flexDirection: "row",
    marginTop: "auto",
    gap: 20,
  },
  actionButton: {
    flex: 1,
    flexBasis: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BORDER_RADIUS,
    gap: 10,
    height: 60,
  },
});
