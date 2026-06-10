import { Facility, MapMarkerFilter, TrailMarkerResponse } from "@/data/types";
import { FontAwesome6, Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback, useState } from "react";
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";

export interface TrailMarkersMapProps {
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  showsUserLocation?: boolean;
  filter: MapMarkerFilter;
  selectedIdentifier: string | null;
  onTrailSelect: (identifier: string | null) => void;
  onMapReady?: () => void;
  isFocused: boolean;
}

// Shared pin shape used by all marker types.
export const MapPin = memo(function MapPin({
  color,
  children,
  onLayout,
}: {
  color: string;
  children: React.ReactNode;
  onLayout?: () => void;
}) {
  return (
    <View style={s.pinWrapper} onLayout={onLayout}>
      <View style={[s.pinBody, { backgroundColor: color }]}>{children}</View>
      <View style={[s.pinTip, { borderTopColor: color }]} />
    </View>
  );
});

// iOS: tracksViewChanges stays true — MapKit must not snapshot the view mid-tap
//       (causes native crash). Small perf cost, necessary for correctness.
// Android: flip to false after first layout — stops per-frame polling (perf).
export const TrailStartMarker = memo(function TrailStartMarker({
  trail,
  color,
  iconColor,
  onPress,
}: {
  trail: TrailMarkerResponse;
  color: string;
  iconColor: string;
  onPress: (id: string) => void;
}) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const handlePress = useCallback(() => onPress(trail.identifier), [onPress, trail.identifier]);
  const handleLayout = useCallback(
    () => { if (Platform.OS === "android") setTracksViewChanges(false); },
    [],
  );
  return (
    <Marker
      coordinate={{ latitude: Number(trail.startLatitude), longitude: Number(trail.startLongitude) }}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracksViewChanges}
      onPress={handlePress}
    >
      <MapPin color={color} onLayout={handleLayout}>
        <Ionicons name="trail-sign-outline" size={14} color={iconColor} />
      </MapPin>
    </Marker>
  );
});

export const FacilityMarker = memo(function FacilityMarker({
  facility,
  color,
  iconColor,
  icon,
  iconSize,
}: {
  facility: Facility;
  color: string;
  iconColor: string;
  icon: "bonfire-outline" | "tent";
  iconSize: number;
}) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const handleLayout = useCallback(
    () => { if (Platform.OS === "android") setTracksViewChanges(false); },
    [],
  );
  return (
    <Marker
      coordinate={{ latitude: Number(facility.latitude), longitude: Number(facility.longitude) }}
      title={facility.name}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracksViewChanges}
    >
      <MapPin color={color} onLayout={handleLayout}>
        {icon === "tent" ? (
          <FontAwesome6 name="tent" size={iconSize} color={iconColor} />
        ) : (
          <Ionicons name="bonfire-outline" size={iconSize} color={iconColor} />
        )}
      </MapPin>
    </Marker>
  );
});

export type { MapView };

export const markerStyles = StyleSheet.create({
  pinWrapper: {
    alignItems: "center",
  },
  pinBody: {
    borderRadius: 8,
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  fetchingIndicator: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 16,
    padding: 6,
  },
});

const s = markerStyles;
