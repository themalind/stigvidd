import { StyleSheet } from "react-native";
import { LatLng } from "react-native-maps";
import Map from "@/components/map/map";
import Marker from "@/components/map/marker";

export default function MapScreen() {
  const START_COORDINATE_BORAS = {
    latitude: 57.72096,
    longitude: 12.93816,
    latitudeDelta: 0.2,
    longitudeDelta: 0.1,
  };

  const gesebol: LatLng = {
    latitude: 57.73,
    longitude: 12.70
  };

  return (
      <Map
        style={s.container}
        initialRegion={START_COORDINATE_BORAS}
      >
        <Marker
          coordinate={gesebol}
          title="Gesebol"
          variant="campsite"
        />
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
