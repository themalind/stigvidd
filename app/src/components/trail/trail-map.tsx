import { secondaryMapActiveAtom } from "@/atoms/trail-map-active-atom";
import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import GetRegionFromTrail from "@/utils/get-region-from-trail";
import { Ionicons } from "@expo/vector-icons";
import { useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import MapView, { LatLng, Polyline } from "react-native-maps";
import { Surface, Text, useTheme } from "react-native-paper";
import Map from "../map/map";

interface TrailMapProps {
  trail: LatLng[];
}

function MapButton({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  const theme = useTheme();
  return (
    <View style={[s.buttonWrapper, { backgroundColor: theme.colors.surface }]}>
      <Pressable
        style={s.button}
        onPress={loading ? undefined : onPress}
        android_ripple={loading ? undefined : { color: theme.colors.onSurface }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.primary} style={s.buttonLoader} />
        ) : (
          <>
            <View style={[s.iconWrapper, { backgroundColor: theme.colors.primary }]}>
              <Ionicons name="map-outline" size={24} color={theme.colors.onPrimary} />
            </View>
            <View style={s.textGroup}>
              <Text style={[s.buttonTitle, { color: theme.colors.onSecondaryContainer }]}>Visa led på karta</Text>
              <Text style={[s.buttonSub, { color: theme.colors.onSurfaceVariant }]}>
                Tryck för att öppna interaktiv karta
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.onSurfaceVariant} />
          </>
        )}
      </Pressable>
    </View>
  );
}

function DismissButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable style={[s.dismiss, { backgroundColor: theme.colors.surface }]} onPress={onPress} hitSlop={12}>
      <Ionicons name="close" size={18} color={theme.colors.onSurface} />
    </Pressable>
  );
}

export default function TrailMap({ trail }: TrailMapProps) {
  const theme = useTheme();
  const { height: HEIGHT } = useWindowDimensions();
  const [active, setActive] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const setTrailMapActive = useSetAtom(secondaryMapActiveAtom);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    return () => setTrailMapActive(false);
  }, [setTrailMapActive]);

  const open = useCallback(() => {
    setActive(true);
    setTrailMapActive(true);
  }, [setTrailMapActive]);

  const close = useCallback(() => {
    setActive(false);
    setMapReady(false);
    setTrailMapActive(false);
  }, [setTrailMapActive]);

  const handleMapReady = useCallback(() => {
    mapRef.current?.fitToCoordinates(trail, {
      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
      animated: false,
    });
    setMapReady(true);
  }, [trail]);

  return (
    <Surface elevation={0} style={[s.container, { borderColor: theme.colors.outlineVariant }]}>
      <View style={[s.inner, active && mapReady && { height: HEIGHT * 0.3 }]}>
        {active && (
          <Map
            ref={mapRef}
            style={
              mapReady
                ? StyleSheet.absoluteFill
                : { position: "absolute", width: "100%", height: HEIGHT * 0.3, opacity: 0 }
            }
            initialRegion={GetRegionFromTrail(trail)}
            onMapReady={handleMapReady}
            scrollEnabled
            zoomEnabled
            rotateEnabled
            pitchEnabled
          >
            <Polyline coordinates={trail} strokeWidth={3} strokeColor="#eb3204" />
          </Map>
        )}
        {(!active || !mapReady) && <MapButton onPress={open} loading={active && !mapReady} />}
        {active && mapReady && <DismissButton onPress={close} />}
      </View>
    </Surface>
  );
}

const s = StyleSheet.create({
  container: {
    borderRadius: SURFACE_BORDER_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  inner: {
    borderRadius: SURFACE_BORDER_RADIUS,
    overflow: "hidden",
  },
  buttonWrapper: {
    borderRadius: SURFACE_BORDER_RADIUS,
    overflow: "hidden",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  buttonLoader: {
    flex: 1,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  textGroup: {
    flex: 1,
    gap: 3,
  },
  buttonTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  buttonSub: {
    fontSize: 12,
  },
  dismiss: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.9,
  },
});
