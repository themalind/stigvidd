import { Coordinate } from "@/data/types";
import { StyleSheet, } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { useEffect } from "react";

export default function MapScreen() {
  const START_COORDINATE_BORAS = {
    latitude: 57.72096,
    longitude: 12.93816,
    latitudeDelta: 0.2,
    longitudeDelta: 0.1,
  };

  const gesebol: Coordinate = {
    latitude: 57.73,
    longitude: 12.70
  };

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if ( status !== "granted" ) return;
    })();
  }, []);

  return (
    <MapView 
      style={s.container}
      initialRegion={START_COORDINATE_BORAS}
      showsUserLocation
      showsMyLocationButton={false}
      toolbarEnabled={false}
    >
      <Marker
        coordinate={gesebol}
        title="Gesebol"
        image={require("@/assets/map/marker/vindskydd-100-159.png")}
      />
    </MapView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  marker: {
    flex: 1,
    width: 50,
    height: 50,
  },
});
