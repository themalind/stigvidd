// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import BasemapToggle from "@/components/map/basemap-toggle";
import CenterOnUserButton from "@/components/map/center-on-user-button";
import Map from "@/components/map/map";
import MapBackChip from "@/components/map/map-back-chip";
import MapStatusOverlay from "@/components/map/map-status-overlay";
import UserLocationMarker from "@/components/map/user-location-marker";
import { SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { useArea } from "@/hooks/area/useArea";
import { useLiveUserLocation } from "@/hooks/location/useLiveUserLocation";
import { areaMapShapes } from "@/utils/area/area-map-shapes";
import { Camera, type CameraRef } from "@maplibre/maplibre-react-native";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
import AreaMapLayers, { AREA_TOP_LAYER } from "./area-map-layers";
import AreaMapLegend from "./area-map-legend";

const FIT_PADDING = { top: 100, right: 60, bottom: 120, left: 60 };

export default function AreaMapScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const { data: area, isLoading } = useArea(identifier);
  const userLocation = useLiveUserLocation();

  const cameraRef = useRef<CameraRef>(null);
  const mapReadyRef = useRef(false);
  const shapes = useMemo(() => (area ? areaMapShapes(area) : null), [area]);
  const bounds = shapes?.bounds;

  // keep-comment: the map and the area load independently; whichever is last frames the area
  const frame = useCallback(() => {
    if (mapReadyRef.current && bounds) {
      cameraRef.current?.fitBounds(bounds, { padding: FIT_PADDING, duration: 0 });
    }
  }, [bounds]);

  const handleMapReady = useCallback(() => {
    mapReadyRef.current = true;
    frame();
  }, [frame]);

  useEffect(() => {
    frame();
  }, [frame]);

  const failed = !isLoading && !bounds;

  return (
    <View testID="area-map-screen" style={s.container}>
      <Map style={StyleSheet.absoluteFill} showsUserLocation={false} onDidFinishLoadingMap={handleMapReady}>
        <Camera ref={cameraRef} />
        {shapes && <AreaMapLayers shapes={shapes} lineWidth={4} />}
        {userLocation && (
          <UserLocationMarker
            // keep-comment: remount, not mutate, when the anchor appears (see UserLocationMarker)
            key={shapes ? "anchored" : "no-anchor"}
            id="area-user"
            position={userLocation.position}
            heading={userLocation.heading}
            aboveLayerId={shapes ? AREA_TOP_LAYER : undefined}
          />
        )}
      </Map>

      <MapBackChip title={area?.name} />
      <MapStatusOverlay isLoading={isLoading} errorMessage={failed ? t("map.loadError") : undefined} />

      {shapes && <AreaMapLegend shapes={shapes} style={[s.legend, { backgroundColor: theme.colors.surface }]} />}
      <CenterOnUserButton cameraRef={cameraRef} position={userLocation?.position ?? null} />
      <BasemapToggle />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  legend: {
    position: "absolute",
    left: SURFACE_BORDER_RADIUS,
    bottom: 18,
    maxWidth: "70%",
    padding: SCREEN_PADDING / 2,
    borderRadius: SURFACE_BORDER_RADIUS,
  },
});
