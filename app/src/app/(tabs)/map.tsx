import Map from "@/components/map/map";
import Marker from "@/components/map/marker";
import { StyleSheet } from "react-native";
import { LatLng } from "react-native-maps";

export default function MapScreen() {
  const START_COORDINATE_BORAS = {
    latitude: 57.72096,
    longitude: 12.93816,
    latitudeDelta: 0.2,
    longitudeDelta: 0.1,
  };

  const sam: LatLng = {
    latitude: 57.67372,
    longitude: 12.56592,
  };

  const frodo: LatLng = {
    latitude: 57.72141010663575,
    longitude: 12.905517126805371,
  };

  return (
    <Map style={s.container} initialRegion={START_COORDINATE_BORAS} showsUserLocation>
      <Marker coordinate={frodo} title="Frodo" variant="favourite" />
      <Marker coordinate={sam} title="Sam" variant="favourite" />
    </Map>
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
