import { secondaryMapActiveAtom } from "@/atoms/trail-map-active-atom";
import { START_COORDINATE_BORAS } from "@/constants/constants";
import { useAtomValue } from "jotai";
import React, { forwardRef, memo, useCallback } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import MapView, { LatLng, Polyline } from "react-native-maps";
import { useTheme } from "react-native-paper";
import Map from "./map";
import { FacilityMarker, TrailMarkersMapProps, TrailStartMarker, markerStyles } from "./trail-markers-shared";
import { useTrailMapData } from "./useTrailMapData";

// Android: native tappable polylines — no gesture recognizer issues on this platform.
const TrailPolyline = memo(function TrailPolyline({
  identifier,
  path,
  selected,
  onPress,
}: {
  identifier: string;
  path: LatLng[];
  selected: boolean;
  onPress: (id: string) => void;
}) {
  const handlePress = useCallback(() => onPress(identifier), [onPress, identifier]);
  return (
    <Polyline
      coordinates={path}
      strokeColor={selected ? "#1a5266" : "#2a8099"}
      strokeWidth={selected ? 5 : 3}
      tappable
      onPress={handlePress}
    />
  );
});

export default forwardRef<MapView, TrailMarkersMapProps>(function TrailMarkersMap(
  { style, initialRegion, showsUserLocation, filter, selectedIdentifier, onTrailSelect, onMapReady, isFocused },
  mapRef,
) {
  const theme = useTheme();
  const trailMapActive = useAtomValue(secondaryMapActiveAtom);
  const shelterColor = theme.dark ? "hsl(195, 40%, 52%)" : theme.colors.primary;
  const shelterIconColor = theme.dark ? "hsl(0, 0%, 96%)" : theme.colors.onPrimary;
  const initialRegionRef = initialRegion ?? START_COORDINATE_BORAS;

  const {
    visiblePaths,
    visibleTrailMarkers,
    visibleFirePits,
    visibleShelters,
    isNetworkFetching,
    handleRegionChange,
  } = useTrailMapData({ filter, isFocused, initialRegion: initialRegionRef });

  // Unmount MapView when a secondary map is active to avoid competing OpenGL contexts.
  if (trailMapActive) {
    return <View style={style} />;
  }

  return (
    <View style={style}>
      <Map
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegionRef}
        showsUserLocation={showsUserLocation}
        onRegionChangeComplete={handleRegionChange}
        onPress={() => onTrailSelect(null)}
        onMapReady={onMapReady}
      >
        {visiblePaths.map((t) => (
          <TrailPolyline
            key={t.identifier}
            identifier={t.identifier}
            path={t.path}
            selected={selectedIdentifier === t.identifier}
            onPress={onTrailSelect}
          />
        ))}

        {filter.trails &&
          visibleTrailMarkers.map((t) => (
            <TrailStartMarker
              key={`${t.identifier}-${theme.dark}`}
              trail={t}
              color={theme.colors.tertiary}
              iconColor={theme.colors.onTertiary}
              onPress={onTrailSelect}
            />
          ))}

        {filter.firePits &&
          visibleFirePits.map((f) => (
            <FacilityMarker
              key={`${f.identifier}-${theme.dark}`}
              facility={f}
              color={theme.colors.secondary}
              iconColor={theme.colors.onSecondary}
              icon="bonfire-outline"
              iconSize={14}
            />
          ))}

        {filter.shelters &&
          visibleShelters.map((f) => (
            <FacilityMarker
              key={`${f.identifier}-${theme.dark}`}
              facility={f}
              color={shelterColor}
              iconColor={shelterIconColor}
              icon="tent"
              iconSize={12}
            />
          ))}
      </Map>

      {isNetworkFetching && (
        <View style={markerStyles.fetchingIndicator} pointerEvents="none">
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}
    </View>
  );
});
