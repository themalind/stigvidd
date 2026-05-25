import { START_COORDINATE_BORAS } from "@/constants/constants";
import { MapMarkerFilter, TrailPathResponse } from "@/data/types";
import { FontAwesome6, Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { forwardRef, useCallback, useMemo, useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import MapView, { Marker, Polyline, Region } from "react-native-maps";
import { useTheme } from "react-native-paper";
import { getFacilityMarkers, getTrailMarkers, getTrailPaths, TrailPathBounds } from "@/api/map-markers";
import Map from "./map";

interface Props {
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  showsUserLocation?: boolean;
  filter: MapMarkerFilter;
  selectedTrail: TrailPathResponse | null;
  onTrailSelect: (trail: TrailPathResponse | null) => void;
  onMapReady?: () => void;
}

function regionToBounds(region: Region): TrailPathBounds {
  return {
    minLat: Math.round((region.latitude - region.latitudeDelta / 2) * 1000) / 1000,
    maxLat: Math.round((region.latitude + region.latitudeDelta / 2) * 1000) / 1000,
    minLon: Math.round((region.longitude - region.longitudeDelta / 2) * 1000) / 1000,
    maxLon: Math.round((region.longitude + region.longitudeDelta / 2) * 1000) / 1000,
  };
}

function MapPin({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <View style={s.pinWrapper}>
      <View style={[s.pinBody, { backgroundColor: color }]}>{children}</View>
      <View style={[s.pinTip, { borderTopColor: color }]} />
    </View>
  );
}

export default forwardRef<MapView, Props>(function TrailMarkersMap(
  { style, initialRegion, showsUserLocation, filter, selectedTrail, onTrailSelect, onMapReady }: Props,
  mapRef,
) {
  const theme = useTheme();
  const [bounds, setBounds] = useState<TrailPathBounds>(
    regionToBounds(initialRegion ?? START_COORDINATE_BORAS),
  );

  const { data: trailPaths } = useQuery({
    queryKey: ["trails", "paths", bounds],
    queryFn: () => getTrailPaths(bounds),
    enabled: filter.trails,
  });

  const { data: trailMarkers } = useQuery({
    queryKey: ["trails", "markers"],
    queryFn: getTrailMarkers,
    enabled: filter.trails,
  });

  const { data: facilities } = useQuery({
    queryKey: ["facilities", "markers"],
    queryFn: getFacilityMarkers,
    enabled: filter.firePits || filter.shelters,
  });

  const firePits = useMemo(() => facilities?.filter((f) => f.facilityType === 1), [facilities]);
  const shelters = useMemo(() => facilities?.filter((f) => f.facilityType === 2), [facilities]);
  const combined = useMemo(() => facilities?.filter((f) => f.facilityType === 3), [facilities]);

  const handleRegionChange = useCallback((region: Region) => setBounds(regionToBounds(region)), []);

  const startCoord = selectedTrail?.path[0];

  return (
    <Map
      ref={mapRef}
      style={style}
      initialRegion={initialRegion ?? START_COORDINATE_BORAS}
      showsUserLocation={showsUserLocation}
      onRegionChangeComplete={handleRegionChange}
      onPress={() => onTrailSelect(null)}
      {...(onMapReady !== undefined && { onMapReady })}
    >
      {filter.trails &&
        trailPaths
          ?.filter((t) => !filter.accessibility || t.isAccessible)
          .map((t) => (
            <Polyline
              key={t.identifier}
              coordinates={t.path}
              strokeColor={selectedTrail?.identifier === t.identifier ? "#1a5266" : "#2a8099"}
              strokeWidth={selectedTrail?.identifier === t.identifier ? 5 : 3}
              zIndex={selectedTrail?.identifier === t.identifier ? 2 : 1}
              tappable
              onPress={() => onTrailSelect(t)}
            />
          ))}

      {filter.trails &&
        trailMarkers
          ?.filter((t) => t.startLatitude != null && t.startLongitude != null && (!filter.accessibility || t.isAccessible) && t.identifier !== selectedTrail?.identifier)
          .map((t) => {
            const trailPath = trailPaths?.find((p) => p.identifier === t.identifier);
            return (
              <Marker
                key={t.identifier}
                coordinate={{ latitude: Number(t.startLatitude), longitude: Number(t.startLongitude) }}
                anchor={{ x: 0.5, y: 1 }}
                calloutEnabled={false}
                onPress={() => trailPath && onTrailSelect(trailPath)}
              >
                <MapPin color={theme.colors.secondary}>
                  <Ionicons name="trail-sign-outline" size={14} color={theme.colors.onSecondary} />
                </MapPin>
              </Marker>
            );
          })}

      {filter.firePits &&
        firePits
          ?.filter((f) => f.latitude != null && f.longitude != null && (!filter.accessibility || f.isAccessible))
          .map((f) => (
            <Marker
              key={f.identifier}
              coordinate={{ latitude: Number(f.latitude), longitude: Number(f.longitude) }}
              title={f.name}
              anchor={{ x: 0.5, y: 1 }}
            >
              <MapPin color={theme.colors.tertiary}>
                <Ionicons name="bonfire-outline" size={14} color={theme.colors.onTertiary} />
              </MapPin>
            </Marker>
          ))}

      {filter.shelters &&
        shelters
          ?.filter((f) => f.latitude != null && f.longitude != null && (!filter.accessibility || f.isAccessible))
          .map((f) => (
            <Marker
              key={f.identifier}
              coordinate={{ latitude: Number(f.latitude), longitude: Number(f.longitude) }}
              title={f.name}
              anchor={{ x: 0.5, y: 1 }}
            >
              <MapPin color={theme.colors.primary}>
                <FontAwesome6 name="tent" size={12} color={theme.colors.onPrimary} />
              </MapPin>
            </Marker>
          ))}

      {(filter.firePits || filter.shelters) &&
        combined
          ?.filter((f) => f.latitude != null && f.longitude != null && (!filter.accessibility || f.isAccessible))
          .map((f) => (
            <Marker
              key={f.identifier}
              coordinate={{ latitude: Number(f.latitude), longitude: Number(f.longitude) }}
              title={f.name}
              anchor={{ x: 0.5, y: 1 }}
            >
              <MapPin color={theme.colors.secondary}>
                <Ionicons name="bonfire-outline" size={14} color={theme.colors.onSecondary} />
              </MapPin>
            </Marker>
          ))}

      {startCoord && (
        <Marker coordinate={startCoord} anchor={{ x: 0.5, y: 1 }}>
          <MapPin color={theme.colors.primary}>
            <Ionicons name="trail-sign-outline" size={14} color={theme.colors.onPrimary} />
          </MapPin>
        </Marker>
      )}
    </Map>
  );
});

const s = StyleSheet.create({
  pinWrapper: {
    alignItems: "center",
  },
  pinBody: {
    borderRadius: 8,
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
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
});
