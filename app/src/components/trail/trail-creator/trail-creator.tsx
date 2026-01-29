import Map from "@/components/map/map";
import { useLocationTracking } from "@/services/use-location-tracking";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import MapView, { Polyline, Region } from "react-native-maps";
import { Button, Text } from "react-native-paper";
import * as Location from "expo-location";

const HEIGHT = Dimensions.get("screen").height;

export default function TrailCreator() {
  const mapRef = useRef<MapView>(null);
  const { startTracking, stopTracking, resetTracking, isTracking, coordinates } = useLocationTracking();
  const [initialRegion, setInitialRegion] = useState<Region | undefined>(undefined);

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

  function dumpTrailToLog() {
    const chunkSize = 50;

    for (let i = 0; i < polylineCoords.length; i += chunkSize) {
      console.log(JSON.stringify(polylineCoords.slice(i, i + chunkSize)));
    }
  }

  if (!initialRegion) return <Text>Loading Map...</Text>;

  return (
    <View style={{}}>
      <View style={s.mapContainer}>
        <Map ref={mapRef} style={s.map} initialRegion={initialRegion} showsUserLocation>
          <Polyline coordinates={polylineCoords} strokeColor="#ff0000" strokeWidth={4} />
        </Map>
      </View>

      <View style={s.buttons}>
        <Button mode="contained-tonal" onPress={() => dumpTrailToLog()}>
          DUMP
        </Button>
        <Button
          mode={!isTracking ? "outlined" : "contained-tonal"}
          onPress={!isTracking ? () => startTracking() : () => stopTracking()}
        >
          {!isTracking ? "START" : "PAUSE"}
        </Button>
        <Button mode="contained-tonal" onPress={() => resetTracking()}>
          NOLLSTÄLL ({coordinates.length})
        </Button>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  red: {
    borderColor: "red",
    borderWidth: 1,
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
    height: HEIGHT * 0.25,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
  },
});
