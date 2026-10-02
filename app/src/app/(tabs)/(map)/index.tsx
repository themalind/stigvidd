// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ErrorView from "@/components/error-view";
import CenterOnUserButton from "@/components/map/center-on-user-button";
import MapFilterMenu from "@/components/map/map-filter-menu";
import TrailCardCarousel from "@/components/map/trail-card-carousel";
import TrailMarkersMap, { type MapHighlight } from "@/components/map/trail-markers-map";
import OfflineNotice from "@/components/offline-notice";
import { SCREEN_PADDING } from "@/constants/constants";
import { MapMarkerFilter } from "@/data/types";
import { useIsOnline } from "@/hooks/useIsOnline";
import { useUserLocation } from "@/hooks/useUserLocation";
import { type ClusterZoomBand, clusterZoomBand, isZoomOutsideBand } from "@/utils/cluster-zoom-band";
import { guardedNavigate } from "@/utils/navigation";
import { type CameraRef, type InitialViewState, type ViewStateChangeEvent } from "@maplibre/maplibre-react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { NativeSyntheticEvent, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

export default function MapScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const isOnline = useIsOnline();

  const cameraRef = useRef<CameraRef>(null);
  // The map unmounts on blur and this screen does not, so the camera is re-seeded from here; a ref so panning never re-renders. keep-comment: hidden lifecycle
  const lastViewState = useRef<InitialViewState | null>(null);
  // Zooms within which the open cluster still matches the map; null when nothing is open. See cluster-zoom-band.ts. keep-comment: non-obvious invariant
  const clusterZoomRange = useRef<ClusterZoomBand | null>(null);

  const { data: userLocation } = useUserLocation();
  // One glide per session, so it never fights a remembered view. keep-comment: why a ref
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
  // Measured, since card height varies, so the attribution button can sit above the cards. keep-comment: why measured
  const [carouselHeight, setCarouselHeight] = useState(0);
  const [highlight, setHighlight] = useState<MapHighlight | null>(null);

  const handleMapReady = useCallback(() => setIsMapReady(true), []);
  // Offline the style never loads, so there is no map to filter or centre. keep-comment: hidden native behaviour
  const offlineScreen = !isOnline && !isMapReady;

  // Not gated on lastViewState: the map's first settle writes it before the location arrives. keep-comment: hidden race
  useEffect(() => {
    if (didAutoCenter.current || !isMapReady) return;
    if (!userLocation || userLocation.isFallback) return;
    didAutoCenter.current = true;
    cameraRef.current?.flyTo({ center: [userLocation.longitude, userLocation.latitude], zoom: 12, duration: 1000 });
  }, [isMapReady, userLocation]);

  // The ring sits where the user tapped, so it stays put while the cards are swiped. keep-comment: non-obvious choice
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

      // Outside the band the cluster has split or merged; a programmatic move (the restore on return) never closes it. keep-comment: non-obvious rule
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

  // A cached fix seeds the camera so a warm return skips the Borås flash. keep-comment: why seed
  const seededViewState: InitialViewState | undefined =
    lastViewState.current ??
    (userLocation && !userLocation.isFallback
      ? { center: [userLocation.longitude, userLocation.latitude], zoom: 12 }
      : undefined);

  return (
    <View testID="map-screen" style={s.container}>
      {isFocused && (
        <TrailMarkersMap
          filter={filters}
          style={StyleSheet.absoluteFill}
          cameraRef={cameraRef}
          highlight={highlight}
          initialViewState={seededViewState}
          attributionPosition={{
            bottom: carouselIds ? carouselHeight + SCREEN_PADDING : SCREEN_PADDING,
            left: SCREEN_PADDING,
          }}
          onRegionDidChange={handleRegionDidChange}
          onClusterOpen={openCarousel}
          onMapPress={closeCarousel}
          onMapReady={handleMapReady}
        />
      )}
      {(!isMapReady || !isFocused) && (
        <View testID="map-cover" style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }]} />
      )}

      {offlineScreen && (
        <View testID="map-offline-screen" style={StyleSheet.absoluteFill}>
          {/* No error of its own: offline, ErrorView shows the same screen as every other tab. keep-comment: null is deliberate */}
          <ErrorView error={null} />
        </View>
      )}

      {/* A map loaded from cache stays usable. Before the top bar, so the filter panel drops over it. keep-comment: z-order */}
      {!isOnline && isMapReady && <OfflineNotice testID="map-offline" message={t("map.offline")} style={s.offline} />}

      {/* No safe-area offset: the app header already clears the status bar. keep-comment: layout constraint */}
      {!offlineScreen && (
        <View testID="map-top-bar" style={s.topBar}>
          <MapFilterMenu filter={filters} onChange={setFilters} />
        </View>
      )}

      {!carouselIds && !offlineScreen && <CenterOnUserButton cameraRef={cameraRef} />}

      {carouselIds && (
        <TrailCardCarousel
          identifiers={carouselIds}
          onMeasure={setCarouselHeight}
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
  offline: {
    position: "absolute",
    top: SCREEN_PADDING,
    left: SCREEN_PADDING,
    // Leaves the top-right corner to the filter menu at large font sizes. keep-comment: why a cap
    maxWidth: "55%",
  },
  topBar: {
    position: "absolute",
    top: SCREEN_PADDING,
    right: SCREEN_PADDING,
  },
});
