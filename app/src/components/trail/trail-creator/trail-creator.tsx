import Map from "@/components/map/map";
import { useLocationTracking } from "@/services/use-location-tracking";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import MapView, { Polyline, Region } from "react-native-maps";
import { Text, useTheme } from "react-native-paper";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import AlertDialog from "@/components/alert-dialog";

export default function TrailCreator() {
  const mapRef = useRef<MapView>(null);
  const { startTracking, stopTracking, resetTracking, isTracking, hike, currentSegment, getActiveTime, debugAddPoint } =
    useLocationTracking();
  const [tick, setTick] = useState(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [initialRegion, setInitialRegion] = useState<Region | undefined>(undefined);
  const theme = useTheme();

  const polylineCoords = useMemo(() => {
    const finished = hike.segments.flatMap((segment) => segment.coordinates.map((locationData) => locationData.data));

    const current = currentSegment ? currentSegment.coordinates.map((locationData) => locationData.data) : [];

    return [...finished, ...current];
  }, [hike.segments, currentSegment]);

  useEffect(() => {
    if (!isTracking) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isTracking]);

  const formattedTime = (() => {
    const ms = getActiveTime();
    const totalSeconds = Math.floor(ms / 1000);

    const seconds = totalSeconds % 60;
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const hours = Math.floor(totalSeconds / 3600);

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  })();

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

    mapRef.current.animateCamera(
      {
        center: last,
        zoom: 17,
      },
      { duration: 500 },
    );
  }, [polylineCoords]);

  const hasData = hike.segments.length > 0 || (currentSegment && currentSegment.coordinates.length > 0);

  if (!initialRegion) return <Text>Loading Map...</Text>;

  return (
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.debug}>
        <Text>
          debug: {polylineCoords.length} noder, {hike.segments.length} segments
        </Text>

        <Pressable onPress={() => debugAddPoint()}>
          <Text>Add</Text>
        </Pressable>
      </View>

      <View style={s.mapContainer}>
        <Map ref={mapRef} style={s.map} initialRegion={initialRegion} showsUserLocation>
          <Polyline coordinates={polylineCoords} strokeColor="#ff0000" strokeWidth={4} />
        </Map>
      </View>

      <View style={[s.infoSection, { backgroundColor: theme.colors.surface }]}>
        <Text style={s.InfoText}>{formattedTime}</Text>
      </View>

      <View style={[s.infoSection, { backgroundColor: theme.colors.surface }]}>
        <Text style={s.InfoText}>{formattedDistance}</Text>
      </View>

      <View style={s.actions}>
        {!hasData ? (
          <Pressable
            style={[s.actionButton, { backgroundColor: theme.colors.surface }]}
            onPress={() => startTracking()}
          >
            <Ionicons name="walk-outline" size={30} color={theme.colors.onSurface} />
            <Text style={{ color: theme.colors.onSurface }}>Starta vandring</Text>
          </Pressable>
        ) : isTracking ? (
          <Pressable style={[s.actionButton, { backgroundColor: theme.colors.surface }]} onPress={() => stopTracking()}>
            <Ionicons name="pause" size={30} color={theme.colors.onSurface} />
          </Pressable>
        ) : (
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
              onPress={() => setShowSaveDialog(true)}
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

      <AlertDialog
        visible={showDeleteDialog}
        onDismiss={() => setShowDeleteDialog(false)}
        onConfirm={() => {
          resetTracking();
          setShowDeleteDialog(false);
        }}
        title={"Avbryt pågående promenad"}
        infoText={["Vill du verkligen avbryta den pågående promenad?", "Detta går inte att ångra."]}
        backgroundColor={theme.colors.backdrop}
        textColor={theme.colors.onBackground}
        cancelText={"Nej"}
        confirmText={"Ja"}
      />
      <AlertDialog
        visible={showSaveDialog}
        onDismiss={() => setShowSaveDialog(false)}
        onConfirm={() => {
          resetTracking();
          setShowSaveDialog(false);
        }}
        title={"Spara promenad"}
        infoText={["Vill du spara din promenad?", 'Sparade promenader kan hittas under "Mina egna promenader"']}
        backgroundColor={theme.colors.backdrop}
        textColor={theme.colors.onBackground}
        cancelText={"Nej"}
        confirmText={"Ja"}
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
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 20,
  },
  infoSection: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    height: 80,
    marginBottom: 20,
  },
  InfoText: {
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
    borderRadius: 10,
    gap: 10,
    height: 60,
  },
});
