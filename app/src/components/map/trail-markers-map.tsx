import { getTrailPaths, getFacilityMarkers, getTrailMarkers, TrailPathBounds } from "@/api/map-markers";
import { START_COORDINATE_BORAS } from "@/constants/constants";
import { MapMarkerFilter, TrailPathLite } from "@/data/types";
import { getCachedPaths, getZoomLevel, setCachedPaths, snapBounds } from "@/services/trail-path-cache";
import { FontAwesome6, Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import MapView, { Marker, Polyline, Region } from "react-native-maps";
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

function MapPin({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <View style={s.pinWrapper}>
      <View style={[s.pinBody, { backgroundColor: color }]}>{children}</View>
      <View style={[s.pinTip, { borderTopColor: color }]} />
    </View>
  );
}

export default forwardRef<MapView, Props>(function TrailMarkersMap(
  { style, initialRegion, showsUserLocation, filter, selectedIdentifier, onTrailSelect, onMapReady }: Props,
  mapRef,
) {
  const theme = useTheme();
  // Incremented on every new fetch; used to discard responses from superseded requests
  // when the user pans faster than the network can respond.
  const fetchCounter = useRef(0);
  const initialRegionRef = initialRegion ?? START_COORDINATE_BORAS;

  // Bundling bounds + latitudeDelta into one object avoids a separate state update
  // for each field and ensures the fetch effect always sees a consistent snapshot.
  const [viewState, setViewState] = useState({
    bounds: regionToBounds(initialRegionRef),
    latitudeDelta: initialRegionRef.latitudeDelta,
  });

  // Keeps the previously fetched paths visible while a new fetch is in flight,
  // so the map never goes blank during panning.
  const [displayedPaths, setDisplayedPaths] = useState<TrailPathLite[]>([]);
  const [isNetworkFetching, setIsNetworkFetching] = useState(false);

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
    // Snapshot the counter value so we can detect if a newer request has started
    // by the time this async function resolves.
    const thisRequest = ++fetchCounter.current;

    async function fetchPaths() {
      const cached = await getCachedPaths(viewState.bounds, level);

      if (!active) return;

      if (cached) {
        // Cache hit — render immediately, no loading indicator needed.
        setDisplayedPaths(cached);
        setIsNetworkFetching(false);
        return;
      }

      setIsNetworkFetching(true);

      try {
        // Snap to LOD grid before sending to the API so the server receives
        // a slightly larger but grid-aligned bounding box, matching the cache key.
        const snapped = snapBounds(viewState.bounds, level);
        const data = await getTrailPaths(snapped);
        // Discard if a newer pan has already started a more recent request.
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

  const handleRegionChange = useCallback((region: Region) => {
    setViewState({
      bounds: regionToBounds(region),
      latitudeDelta: region.latitudeDelta,
    });
  }, []);

  const selectedPath = displayedPaths.find((p) => p.identifier === selectedIdentifier);
  const startCoord = selectedPath?.path[0];

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
      {filter.trails &&
        displayedPaths
          // Accessibility data lives on trailMarkers (global fetch), not on the
          // lean path data, so we cross-reference by identifier here.
          .filter((t) => !filter.accessibility || trailMarkers?.find((m) => m.identifier === t.identifier)?.isAccessible)
          .map((t) => (
            <Polyline
              key={t.identifier}
              coordinates={t.path}
              strokeColor={selectedIdentifier === t.identifier ? "#1a5266" : "#2a8099"}
              strokeWidth={selectedIdentifier === t.identifier ? 5 : 3}
              zIndex={selectedIdentifier === t.identifier ? 2 : 1}
              tappable
              onPress={() => onTrailSelect(t.identifier)}
            />
          ))}

      {filter.trails &&
        trailMarkers
          ?.filter(
            (t) =>
              t.startLatitude != null &&
              t.startLongitude != null &&
              (!filter.accessibility || t.isAccessible) &&
              t.identifier !== selectedIdentifier,
          )
          .map((t) => (
            <Marker
              key={t.identifier}
              coordinate={{ latitude: Number(t.startLatitude), longitude: Number(t.startLongitude) }}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => onTrailSelect(t.identifier)}
            >
              <MapPin color={theme.colors.secondary}>
                <Ionicons name="trail-sign-outline" size={14} color={theme.colors.onSecondary} />
              </MapPin>
            </Marker>
          ))}

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
