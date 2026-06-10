import { getFacilityMarkers, getTrailMarkers, getTrailPaths, TrailPathBounds } from "@/api/map-markers";
import { START_COORDINATE_BORAS } from "@/constants/constants";
import { Facility, MapMarkerFilter, TrailMarkerResponse, TrailPathLite } from "@/data/types";
import {
  getCachedTiles,
  getZoomLevel,
  getTilesForBounds,
  mergePathTiles,
  setTileCached,
  tileBounds,
} from "@/services/trail-path-cache";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Region } from "react-native-maps";

export function regionToBounds(region: Region): TrailPathBounds {
  return {
    minLat: Math.round((region.latitude - region.latitudeDelta / 2) * 1000) / 1000,
    maxLat: Math.round((region.latitude + region.latitudeDelta / 2) * 1000) / 1000,
    minLon: Math.round((region.longitude - region.longitudeDelta / 2) * 1000) / 1000,
    maxLon: Math.round((region.longitude + region.longitudeDelta / 2) * 1000) / 1000,
  };
}

interface TrailMapDataProps {
  filter: MapMarkerFilter;
  isFocused: boolean;
  initialRegion: Region;
}

export interface TrailMapData {
  visiblePaths: TrailPathLite[];
  visibleTrailMarkers: TrailMarkerResponse[];
  visibleFirePits: Facility[];
  visibleShelters: Facility[];
  isNetworkFetching: boolean;
  handleRegionChange: (region: Region) => void;
  latitudeDelta: number;
}

export function useTrailMapData({ filter, isFocused, initialRegion }: TrailMapDataProps): TrailMapData {
  const fetchCounter = useRef(0);
  const lastLevelRef = useRef<number>(0);
  const pendingRegion = useRef<Region | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [viewState, setViewState] = useState({
    bounds: regionToBounds(initialRegion),
    latitudeDelta: initialRegion.latitudeDelta,
  });

  const [displayedPaths, setDisplayedPaths] = useState<TrailPathLite[]>([]);
  const [isNetworkFetching, setIsNetworkFetching] = useState(false);

  const { data: trailMarkers } = useQuery({
    queryKey: ["trails", "markers"],
    queryFn: getTrailMarkers,
    enabled: filter.trails && isFocused,
    staleTime: 5 * 60 * 1000,
  });

  const { data: facilities } = useQuery({
    queryKey: ["facilities", "markers"],
    queryFn: getFacilityMarkers,
    enabled: (filter.firePits || filter.shelters) && isFocused,
    staleTime: 5 * 60 * 1000,
  });

  // O(1) accessibility lookup — avoids O(n²) per render.
  const accessibleIds = useMemo(
    () => new Set(trailMarkers?.filter((m) => m.isAccessible).map((m) => m.identifier) ?? []),
    [trailMarkers],
  );

  const firePits = useMemo(
    () => facilities?.filter((f) => f.facilityType === 1 || f.facilityType === 3) ?? [],
    [facilities],
  );
  const shelters = useMemo(
    () => facilities?.filter((f) => f.facilityType === 2 || f.facilityType === 3) ?? [],
    [facilities],
  );

  const visibleTrailMarkers = useMemo(
    () =>
      trailMarkers?.filter(
        (t) =>
          t.startLatitude != null &&
          t.startLongitude != null &&
          (!filter.accessibility || accessibleIds.has(t.identifier)),
      ) ?? [],
    [trailMarkers, filter.accessibility, accessibleIds],
  );

  const visibleFirePits = useMemo(
    () => firePits.filter((f) => !filter.accessibility || f.isAccessible),
    [firePits, filter.accessibility],
  );

  const visibleShelters = useMemo(
    () => shelters.filter((f) => !filter.accessibility || f.isAccessible),
    [shelters, filter.accessibility],
  );

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
    if (!filter.trails || !isFocused) {
      setDisplayedPaths([]);
      setIsNetworkFetching(false);
      return;
    }

    const level = getZoomLevel(viewState.latitudeDelta);

    if (level === 0) {
      setDisplayedPaths([]);
      setIsNetworkFetching(false);
      lastLevelRef.current = 0;
      return;
    }

    const levelChanged = lastLevelRef.current !== level;
    lastLevelRef.current = level;
    if (levelChanged) setDisplayedPaths([]);

    let active = true;
    const thisRequest = ++fetchCounter.current;

    async function fetchPaths() {
      const tiles = getTilesForBounds(viewState.bounds, level as 1 | 2 | 3);
      const { hits, misses } = await getCachedTiles(tiles, level as 1 | 2 | 3);

      const isCurrent = () => active && fetchCounter.current === thisRequest;

      if (misses.length === 0) {
        if (isCurrent()) {
          setDisplayedPaths((prev) => mergePathTiles([prev, ...[...hits.values()]]));
          setIsNetworkFetching(false);
        }
        return;
      }

      if (isCurrent()) {
        if (hits.size > 0) setDisplayedPaths((prev) => mergePathTiles([prev, ...[...hits.values()]]));
        setIsNetworkFetching(true);
      }

      const results = await Promise.allSettled(
        misses.map(async ({ x, y }) => {
          const data = await getTrailPaths(tileBounds(x, y, level as 1 | 2 | 3));
          await setTileCached(x, y, level, data);
          return data;
        }),
      );

      if (!isCurrent()) return;

      const fetched = results
        .filter((r): r is PromiseFulfilledResult<TrailPathLite[]> => r.status === "fulfilled")
        .map((r) => r.value);

      setDisplayedPaths((prev) => mergePathTiles([prev, ...fetched]));
      setIsNetworkFetching(false);
    }

    fetchPaths();

    return () => {
      active = false;
    };
  }, [viewState, filter.trails, isFocused]);

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
    }, 150);
  }, []);

  return {
    visiblePaths,
    visibleTrailMarkers,
    visibleFirePits,
    visibleShelters,
    isNetworkFetching,
    handleRegionChange,
    latitudeDelta: viewState.latitudeDelta,
  };
}

// Re-export for use in platform files
export { START_COORDINATE_BORAS };
