import Map from "@/components/map/map";
import { useLocationTracking } from "@/services/use-location-tracking";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import MapView, { Polyline, Region } from "react-native-maps";
import { Text, useTheme } from "react-native-paper";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

const HEIGHT = Dimensions.get("screen").height;

export default function TrailCreator() {
  const mapRef = useRef<MapView>(null);
  const { startTracking, stopTracking, resetTracking, isTracking, coordinates } = useLocationTracking();
  const [initialRegion, setInitialRegion] = useState<Region | undefined>(undefined);
  const theme = useTheme();

  const polylineCoords = useMemo(() => coordinates.map((locationData) => locationData.coordinates), [coordinates]);

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

  if (!initialRegion) return <Text>Loading Map...</Text>;

  return (
    <View style={s.content}>
      {/* MAP */}
      <View style={s.mapContainer}>
        <Map ref={mapRef} style={s.map} initialRegion={initialRegion} showsUserLocation>
          <Polyline coordinates={polylineCoords} strokeColor="#ff0000" strokeWidth={4} />
        </Map>
      </View>

      {/* TIME */}

      <View style={s.placeholderSection}>
        <Text>TIME</Text>
      </View>

      {/* DISTANCE */}

      <View style={s.placeholderSection}>
        <Text>DISTANCE</Text>
        <Text>(debug: {polylineCoords.length} noder sparade)</Text>
      </View>

      {/* ACTIONS */}

      <View style={s.actions}>
        {polylineCoords.length === 0 ? (
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
              onPress={() => resetTracking()}
            >
              <Ionicons name="close" size={30} color={theme.colors.onSurface} />
            </Pressable>
            <Pressable
              style={[s.actionButton, { backgroundColor: theme.colors.surface }]}
              onPress={() => startTracking()}
            >
              <Ionicons name="play" size={30} color={theme.colors.onSurface} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  placeholderSection: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#555500",
    borderRadius: 10,
    height: 80,
    marginBottom: 20,
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
    height: HEIGHT * 0.2,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 20,
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
