import { secondaryMapActiveAtom } from "@/atoms/trail-map-active-atom";
import { START_COORDINATE_BORAS } from "@/constants/constants";
import { TrailPathLite } from "@/data/types";
import { useAtomValue } from "jotai";
import React, { forwardRef, memo, useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, InteractionManager, StyleSheet, View } from "react-native";
import MapView, { LatLng, Polyline } from "react-native-maps";
import { useTheme } from "react-native-paper";
import Map from "./map";
import { FacilityMarker, TrailMarkersMapProps, TrailStartMarker, markerStyles } from "./trail-markers-shared";
import { useTrailMapData } from "./useTrailMapData";

// Flat-earth distance approximation — accurate for < 5 km, fast for hit detection.
const LAT_M = 111000;
const LON_M = 111000 * Math.cos((57.72 * Math.PI) / 180); // ≈ 59 000 m/° for Borås

function ptSegDistM(
  lat: number, lon: number,
  aLat: number, aLon: number,
  bLat: number, bLon: number,
): number {
  const px = (lat - aLat) * LAT_M;
  const py = (lon - aLon) * LON_M;
  const dx = (bLat - aLat) * LAT_M;
  const dy = (bLon - aLon) * LON_M;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt(px * px + py * py);
  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
  const ex = px - t * dx;
  const ey = py - t * dy;
  return Math.sqrt(ex * ex + ey * ey);
}

function nearestTrail(coord: LatLng, paths: TrailPathLite[], thresholdM: number): string | null {
  let best: string | null = null;
  let bestDist = thresholdM;
  for (const trail of paths) {
    const pts = trail.path;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = ptSegDistM(
        coord.latitude, coord.longitude,
        pts[i].latitude, pts[i].longitude,
        pts[i + 1].latitude, pts[i + 1].longitude,
      );
      if (d < bestDist) { bestDist = d; best = trail.identifier; }
    }
  }
  return best;
}

// iOS: plain polyline — not natively tappable. Tap detection is handled by
// MapView.onPress + nearestTrail(), avoiding gesture recognizer accumulation
// that causes memory pressure and app termination after extended use.
const TrailPolyline = memo(function TrailPolyline({
  path,
  selected,
}: {
  path: LatLng[];
  selected: boolean;
}) {
  return (
    <Polyline
      coordinates={path}
      strokeColor={selected ? "#1a5266" : "#2a8099"}
      strokeWidth={selected ? 5 : 3}
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

  // MapKit fires MapView.onPress immediately after Marker.onPress on iOS.
  // Suppress the map-level deselect for a short window after any selection.
  const suppressMapPressRef = useRef(false);
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    };
  }, []);

  const {
    visiblePaths,
    visibleTrailMarkers,
    visibleFirePits,
    visibleShelters,
    isNetworkFetching,
    handleRegionChange,
    latitudeDelta,
  } = useTrailMapData({ filter, isFocused, initialRegion: initialRegionRef });

  const handleSelectTrail = useCallback(
    (id: string) => {
      suppressMapPressRef.current = true;
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      suppressTimerRef.current = setTimeout(() => {
        suppressMapPressRef.current = false;
      }, 300);
      // Defer state update until MapKit has finished processing the tap event —
      // calling setState synchronously inside a native map callback can crash on iOS.
      InteractionManager.runAfterInteractions(() => {
        onTrailSelect(id);
      });
    },
    [onTrailSelect],
  );

  // iOS: keep MapView mounted when a secondary map is active — Metal handles
  // multiple contexts fine and unmounting repeatedly leaks native MapKit instances.
  // Disable all interactions to prevent competing with the secondary map.
  return (
    <View style={style}>
      <Map
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegionRef}
        showsUserLocation={showsUserLocation}
        onRegionChangeComplete={trailMapActive ? undefined : handleRegionChange}
        onPress={trailMapActive ? undefined : (e) => {
          if (suppressMapPressRef.current) return;
          const coord = e.nativeEvent.coordinate;
          // Threshold scales with zoom so a tap covers ~15px at any zoom level.
          const thresholdM = Math.min(latitudeDelta * 2400, 500);
          const hit = nearestTrail(coord, visiblePaths, thresholdM);
          if (hit) { handleSelectTrail(hit); return; }
          onTrailSelect(null);
        }}
        onMapReady={onMapReady}
        scrollEnabled={!trailMapActive}
        zoomEnabled={!trailMapActive}
        rotateEnabled={!trailMapActive}
        pitchEnabled={!trailMapActive}
      >
        {visiblePaths.map((t) => (
          <TrailPolyline
            key={t.identifier}
            path={t.path}
            selected={selectedIdentifier === t.identifier}
          />
        ))}

        {filter.trails &&
          visibleTrailMarkers.map((t) => (
            <TrailStartMarker
              key={`${t.identifier}-${theme.dark}`}
              trail={t}
              color={theme.colors.tertiary}
              iconColor={theme.colors.onTertiary}
              onPress={handleSelectTrail}
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
