import CenterOnUserButton from "@/components/map/center-on-user-button";
import MapFilterMenu from "@/components/map/map-filter-menu";
import TrailCardCarousel from "@/components/map/trail-card-carousel";
import TrailMarkersMap, { type MapHighlight } from "@/components/map/trail-markers-map";
import { SCREEN_PADDING } from "@/constants/constants";
import { MapMarkerFilter } from "@/data/types";
import { useUserLocation } from "@/hooks/useUserLocation";
import { type ClusterZoomBand, clusterZoomBand, isZoomOutsideBand } from "@/utils/cluster-zoom-band";
import { guardedNavigate } from "@/utils/navigation";
import { type CameraRef, type InitialViewState, type ViewStateChangeEvent } from "@maplibre/maplibre-react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { NativeSyntheticEvent, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "react-native-paper";

export default function MapScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const cameraRef = useRef<CameraRef>(null);
  // Remembers the camera between mounts: the map unmounts on blur (and so loses its
  // view), but this screen stays mounted, so we re-seed the camera from here on
  // return. A ref, not state, so panning/zooming doesn't re-render the whole map.
  const lastViewState = useRef<InitialViewState | null>(null);
  // The zoom band within which the open selection still matches the map; a later zoom
  // out of this band dismisses the carousel. Computed by clusterZoomBand() on tap; null
  // when nothing is open (or the zoom wasn't known at tap time). See cluster-zoom-band.ts.
  const clusterZoomRange = useRef<ClusterZoomBand | null>(null);

  // Opens the map on the user's position, falling back to Borås when there's no
  // location (permission denied or unavailable — the hook reports that via isFallback).
  const { data: userLocation } = useUserLocation();
  // Guards the one-time open-on-user animation so it never fights a remembered view
  // or re-triggers when the user later pans away.
  const didAutoCenter = useRef(false);

  const [isMapReady, setIsMapReady] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [filters, setFilters] = useState<MapMarkerFilter>({
    trails: true,
    shelters: false,
    firePits: false,
    accessibility: false,
  });
  const [carouselIds, setCarouselIds] = useState<string[] | null>(null);
  const [highlight, setHighlight] = useState<MapHighlight | null>(null);

  const handleMapReady = useCallback(() => setIsMapReady(true), []);

  // On the first open, glide the camera to the user once their location arrives. The
  // didAutoCenter ref limits this to one glide per session; since MapScreen stays
  // mounted across the map's blur/focus, a real return visit still finds it set and
  // keeps the remembered view. Skipped when there's no real fix (fallback → Borås).
  // Note: we deliberately don't gate on lastViewState — the map's initial camera
  // settle writes it before the location resolves, which would wrongly cancel the glide.
  useEffect(() => {
    if (didAutoCenter.current || !isMapReady) return;
    if (!userLocation || userLocation.isFallback) return;
    didAutoCenter.current = true;
    cameraRef.current?.flyTo({ center: [userLocation.longitude, userLocation.latitude], zoom: 12, duration: 1000 });
  }, [isMapReady, userLocation]);

  // Ring the tapped cluster/trail for as long as its carousel is open. The position
  // comes from the tap, so the highlight stays put while you swipe between cards —
  // co-located trails would all share the same spot anyway. From the cluster's
  // expansion zoom we derive the band of zooms where the cluster holds together so a
  // later zoom (in or out) can dismiss it once that's no longer the case.
  const openCarousel = useCallback((ids: string[], tapped: MapHighlight, expansionZoom?: number) => {
    setCarouselIds(ids);
    setHighlight(tapped);
    clusterZoomRange.current = clusterZoomBand(lastViewState.current?.zoom, expansionZoom);
  }, []);

  const closeCarousel = useCallback(() => {
    setCarouselIds(null);
    setHighlight(null);
    clusterZoomRange.current = null;
  }, []);

  const handleRegionDidChange = useCallback(
    (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      const { center, zoom, bearing, pitch, userInteraction } = event.nativeEvent;
      lastViewState.current = { center, zoom, bearing, pitch };

      // Zoom in past the top and the cluster has split; zoom out past the bottom and
      // it has merged into a bigger cluster — either way the open carousel no longer
      // matches the map, so close it. Panning and small zooms within the band keep
      // the cluster intact. Programmatic moves (e.g. the camera restore on return)
      // aren't user interaction, so they never close it.
      if (userInteraction && isZoomOutsideBand(zoom, clusterZoomRange.current)) {
        closeCarousel();
      }
    },
    [closeCarousel],
  );

  const showOnMap = useCallback(
    (identifier: string) => {
      guardedNavigate(() =>
        router.navigate({
          pathname: "/(tabs)/(map)/follow/[identifier]",
          params: { identifier },
        }),
      );
    },
    [router],
  );

  const readMore = useCallback(
    (identifier: string) => {
      guardedNavigate(() =>
        router.navigate({
          pathname: "/(tabs)/(map)/trail/[identifier]",
          params: { identifier },
        }),
      );
    },
    [router],
  );

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => startTransition(() => setIsFocused(false));
    }, []),
  );

  // The remembered view wins on return; otherwise seed from the user's location when
  // it's already cached (no Borås flash on a warm re-entry). On a cold start the
  // location isn't ready yet, so we open at the Borås default and the effect below
  // animates over once the fix arrives.
  const seededViewState: InitialViewState | undefined =
    lastViewState.current ??
    (userLocation && !userLocation.isFallback
      ? { center: [userLocation.longitude, userLocation.latitude], zoom: 12 }
      : undefined);

  return (
    <View style={s.container}>
      {isFocused && (
        <TrailMarkersMap
          filter={filters}
          style={StyleSheet.absoluteFill}
          cameraRef={cameraRef}
          highlight={highlight}
          initialViewState={seededViewState}
          onRegionDidChange={handleRegionDidChange}
          onClusterOpen={openCarousel}
          onMapPress={closeCarousel}
          onMapReady={handleMapReady}
        />
      )}
      {(!isMapReady || !isFocused) && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }]} />
      )}

      <View style={[s.topBar, { top: insets.top + 8 }]}>
        <MapFilterMenu filter={filters} onChange={setFilters} />
      </View>

      {!carouselIds && <CenterOnUserButton cameraRef={cameraRef} />}

      {carouselIds && (
        <TrailCardCarousel
          identifiers={carouselIds}
          onClose={closeCarousel}
          onReadMore={readMore}
          onShowOnMap={showOnMap}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    position: "absolute",
    right: SCREEN_PADDING,
  },
});
