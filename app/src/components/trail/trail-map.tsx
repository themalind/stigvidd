import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import GetRegionFromTrail from "@/utils/get-region-from-trail";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import MapView, { LatLng, Polyline } from "react-native-maps";
import { Surface, Text, useTheme } from "react-native-paper";
import Map from "../map/map";

interface TrailMapProps {
  trail: LatLng[];
}

const WIDTH = Dimensions.get("screen").width;
const HEIGHT = Dimensions.get("screen").height;

export default function TrailMap({ trail }: TrailMapProps) {
  const mapRef = useRef<MapView>(null);
  const theme = useTheme();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!mapRef.current || trail.length === 0) return;
    mapRef.current.animateToRegion(GetRegionFromTrail(trail), 500);
  }, [trail]);

  return (
    <Surface style={s.container}>
      <View style={s.inner}>
        {trail.length > 0 && (
          <Map
            style={s.map}
            ref={mapRef}
            initialRegion={GetRegionFromTrail(trail)}
            scrollEnabled={active}
            zoomEnabled={active}
            rotateEnabled={active}
            pitchEnabled={active}
          >
            <Polyline coordinates={trail} strokeWidth={3} strokeColor={theme.colors.primary} />
          </Map>
        )}
        {!active && (
          <Pressable style={s.lockOverlay} onPress={() => setActive(true)}>
            <View style={[s.lockBadge, { backgroundColor: theme.colors.surface }]}>
              <Ionicons name="finger-print-outline" size={20} color={theme.colors.onSurface} />
              <Text style={[s.lockText, { color: theme.colors.onSurface }]}>Tryck för att interagera</Text>
            </View>
          </Pressable>
        )}
        {active && <Pressable style={s.dismissArea} onPress={() => setActive(false)} />}
      </View>
    </Surface>
  );
}

const s = StyleSheet.create({
  container: {
    height: HEIGHT * 0.3,
    borderRadius: SURFACE_BORDER_RADIUS,
  },
  inner: {
    flex: 1,
    borderRadius: SURFACE_BORDER_RADIUS,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  lockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    opacity: 0.9,
  },
  lockText: {
    fontSize: 13,
    fontWeight: "600",
  },
  dismissArea: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 36,
    height: 36,
  },
});
