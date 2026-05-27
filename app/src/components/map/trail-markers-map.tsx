import { getFacilityMarkers, getTrailMarkers, getTrailPaths, TrailPathBounds } from "@/api/map-markers";
import { START_COORDINATE_BORAS } from "@/constants/constants";
import { Facility, MapMarkerFilter, TrailMarkerResponse, TrailPathLite } from "@/data/types";
import { getCachedPaths, getZoomLevel, setCachedPaths, snapBounds } from "@/services/trail-path-cache";
import { FontAwesome6, Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import MapView, { LatLng, Marker, Polyline, Region } from "react-native-maps";
import { useTheme } from "react-native-paper";
import Map from "./map";

interface Props {
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  showsUserLocation?: boolean;
  filter: MapMarkerFilter;
  selectedIdentifier: string | null;
  onTrailSelect: (identifier: string | null) => void;
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

// Memoized so the JSX subtree is not recreated on every parent render.
// onLayout is used by markers to know when the view has been measured so
// they can disable tracksViewChanges after the first layout pass.
const MapPin = memo(function MapPin({
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

// Each trail gets its own memoized polyline. When selectedIdentifier changes
// only the 1–2 affected instances re-render; all others bail out via React.memo
// because their props are unchanged.
// Note: iOS hit-area handling is intentionally omitted until iOS is addressed.
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
      zIndex={selected ? 2 : 1}
      tappable
      onPress={handlePress}
    />
  );
});

// tracksViewChanges starts true so the native layer can measure the custom view,
// then flips to false after the first layout — stopping the per-frame re-render
// polling that causes lag on older devices.
const TrailStartMarker = memo(function TrailStartMarker({
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
  const handleLayout = useCallback(() => setTracksViewChanges(false), []);
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

const FacilityMarker = memo(function FacilityMarker({
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
  const handleLayout = useCallback(() => setTracksViewChanges(false), []);
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

export default forwardRef<MapView, Props>(function TrailMarkersMap(
  { style, initialRegion, showsUserLocation, filter, selectedIdentifier, onTrailSelect, onMapReady }: Props,
  mapRef,
) {
  const theme = useTheme();
  const shelterColor = theme.dark ? "hsl(195, 40%, 52%)" : theme.colors.primary;
  const shelterIconColor = theme.dark ? "hsl(0, 0%, 96%)" : theme.colors.onPrimary;

  const fetchCounter = useRef(0);
  const initialRegionRef = initialRegion ?? START_COORDINATE_BORAS;

  const [viewState, setViewState] = useState({
    bounds: regionToBounds(initialRegionRef),
    latitudeDelta: initialRegionRef.latitudeDelta,
  });

  const [displayedPaths, setDisplayedPaths] = useState<TrailPathLite[]>([]);
  const [isNetworkFetching, setIsNetworkFetching] = useState(false);

  const { data: trailMarkers } = useQuery({
    queryKey: ["trails", "markers"],
    queryFn: getTrailMarkers,
    enabled: filter.trails,
    staleTime: 5 * 60 * 1000,
  });

  const { data: facilities } = useQuery({
    queryKey: ["facilities", "markers"],
    queryFn: getFacilityMarkers,
    enabled: filter.firePits || filter.shelters,
    staleTime: 5 * 60 * 1000,
  });

  // O(1) accessibility lookup — replaces the O(n) .find() that was nested inside
  // every .filter() call, making the old code O(n²) per render.
  const accessibleIds = useMemo(
    () => new Set(trailMarkers?.filter((m) => m.isAccessible).map((m) => m.identifier) ?? []),
    [trailMarkers],
  );

  const firePits = useMemo(() => facilities?.filter((f) => f.facilityType === 1) ?? [], [facilities]);
  const shelters = useMemo(() => facilities?.filter((f) => f.facilityType === 2) ?? [], [facilities]);
  const combined = useMemo(() => facilities?.filter((f) => f.facilityType === 3) ?? [], [facilities]);

  const { minLat, maxLat, minLon, maxLon } = viewState.bounds;

  // Viewport-cull markers: only mount what's inside the current map bounds.
  // Polylines are already viewport-culled at the API level via the bounds query.
  const visibleTrailMarkers = useMemo(
    () =>
      trailMarkers?.filter(
        (t) =>
          t.startLatitude != null &&
          t.startLongitude != null &&
          t.startLatitude >= minLat &&
          t.startLatitude <= maxLat &&
          t.startLongitude >= minLon &&
          t.startLongitude <= maxLon &&
          (!filter.accessibility || accessibleIds.has(t.identifier)),
      ) ?? [],
    [trailMarkers, minLat, maxLat, minLon, maxLon, filter.accessibility, accessibleIds],
  );

  const visibleFirePits = useMemo(
    () =>
      firePits.filter(
        (f) =>
          f.latitude >= minLat &&
          f.latitude <= maxLat &&
          f.longitude >= minLon &&
          f.longitude <= maxLon &&
          (!filter.accessibility || f.isAccessible),
      ),
    [firePits, minLat, maxLat, minLon, maxLon, filter.accessibility],
  );

  const visibleShelters = useMemo(
    () =>
      shelters.filter(
        (f) =>
          f.latitude >= minLat &&
          f.latitude <= maxLat &&
          f.longitude >= minLon &&
          f.longitude <= maxLon &&
          (!filter.accessibility || f.isAccessible),
      ),
    [shelters, minLat, maxLat, minLon, maxLon, filter.accessibility],
  );

  const visibleCombined = useMemo(
    () =>
      combined.filter(
        (f) =>
          f.latitude >= minLat &&
          f.latitude <= maxLat &&
          f.longitude >= minLon &&
          f.longitude <= maxLon &&
          (!filter.accessibility || f.isAccessible),
      ),
    [combined, minLat, maxLat, minLon, maxLon, filter.accessibility],
  );

  // Pre-filter paths once so accessibility isn't re-evaluated per render.
  const visiblePaths = useMemo(
    () => (filter.trails ? displayedPaths.filter((t) => !filter.accessibility || accessibleIds.has(t.identifier)) : []),
    [displayedPaths, filter.trails, filter.accessibility, accessibleIds],
  );

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!filter.trails) {
      setDisplayedPaths([]);
      setIsNetworkFetching(false);
      return;
    }

    const level = getZoomLevel(viewState.latitudeDelta);

    if (level === 0) {
      setDisplayedPaths([]);
      setIsNetworkFetching(false);
      return;
    }

    let active = true;
    const thisRequest = ++fetchCounter.current;

    async function fetchPaths() {
      const cached = await getCachedPaths(viewState.bounds, level);

      if (!active) return;

      if (cached) {
        setDisplayedPaths(cached);
        setIsNetworkFetching(false);
        return;
      }

      setIsNetworkFetching(true);

      try {
        const snapped = snapBounds(viewState.bounds, level);
        const data = await getTrailPaths(snapped);
        if (!active || fetchCounter.current !== thisRequest) return;
        await setCachedPaths(viewState.bounds, level, data);
        setDisplayedPaths(data);
      } catch {
        // Keep old paths visible on error
      } finally {
        if (active && fetchCounter.current === thisRequest) {
          setIsNetworkFetching(false);
        }
      }
    }

    fetchPaths();

    return () => {
      active = false;
    };
  }, [viewState, filter.trails]);

  const pendingRegion = useRef<Region | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRegionChange = useCallback((region: Region) => {
    pendingRegion.current = region;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      if (pendingRegion.current) {
        setViewState({
          bounds: regionToBounds(pendingRegion.current),
          latitudeDelta: pendingRegion.current.latitudeDelta,
        });
      }
    }, 300);
  }, []);

  return (
    <View style={style}>
      <Map
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegionRef}
        showsUserLocation={showsUserLocation}
        onRegionChangeComplete={handleRegionChange}
        onPress={() => onTrailSelect(null)}
        {...(onMapReady !== undefined && { onMapReady })}
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

        {(filter.firePits || filter.shelters) &&
          visibleCombined.map((f) => (
            <FacilityMarker
              key={`${f.identifier}-${theme.dark}`}
              facility={f}
              color={theme.colors.secondary}
              iconColor={theme.colors.onSecondary}
              icon="bonfire-outline"
              iconSize={14}
            />
          ))}
      </Map>

      {isNetworkFetching && (
        <View style={s.fetchingIndicator} pointerEvents="none">
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      )}
    </View>
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
  fetchingIndicator: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 16,
    padding: 6,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
});
