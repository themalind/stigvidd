// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
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
import { ROUTE_LINE_COLOR, routeCasingPaint } from "@/components/map/marker-styles";
import StartMarker from "@/components/map/start-marker";
import UserLocationMarker from "@/components/map/user-location-marker";
import { useLiveUserLocation } from "@/hooks/location/useLiveUserLocation";
import { lineStringFromPositions } from "@/utils/geo/geojson";
import getBoundsFromTrail from "@/utils/geo/get-bounds-from-trail";
import { SINGLE_POINT_ZOOM, initialViewFor } from "@/utils/map/initial-view";
import { MeetingPoint, openDirectionsToStart } from "@/utils/map/open-directions";
import { Camera, type CameraRef, GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

// Shared by trail and hike follow so the two cannot drift apart; each passes in its own path. keep-comment: why shared
const FIT_PADDING = { top: 100, right: 60, bottom: 120, left: 60 };

interface Props {
  idPrefix: string;
  // [longitude, latitude] keep-comment: GeoJSON order, easy to swap
  path: GeoJSON.Position[];
  title?: string;
  isLoading?: boolean;
  errorMessage?: string;
  meetingPoint?: MeetingPoint;
}

export default function RouteFollowView({ idPrefix, path, title, isLoading, errorMessage, meetingPoint }: Props) {
  const { t } = useTranslation();

  const cameraRef = useRef<CameraRef>(null);
  const mapReadyRef = useRef(false);

  // Our own watcher, since MapLibre's engine freezes the puck mid-walk. keep-comment: platform bug
  const userLocation = useLiveUserLocation();

  const lineShape = useMemo(() => lineStringFromPositions(path), [path]);
  const shown = useMemo(() => (meetingPoint ? [...path, meetingPoint.position] : path), [path, meetingPoint]);
  const bounds = useMemo(() => getBoundsFromTrail(shown), [shown]);

  const lineLayerId = `${idPrefix}-route-line`;
  // Named only once the route exists: the GPS fix usually arrives first, and the puck would wait on a missing layer. keep-comment: race
  // The start label, not the line, so the puck is not buried under the trailhead you stand on. keep-comment: layer order
  const puckAnchor = path.length > 0 ? `${idPrefix}-start-label` : undefined;

  const openDirections = useCallback(() => {
    if (path.length > 0) openDirectionsToStart(path[0], t);
  }, [path, t]);

  // Whichever of the map and the route arrives last does the fit. keep-comment: two triggers on purpose
  const fitToRoute = useCallback(() => {
    if (!mapReadyRef.current) return;
    // fitBounds zooms a single point to the maximum. keep-comment: MapLibre edge case
    if (shown.length === 1)
      cameraRef.current?.jumpTo({ center: shown[0] as [number, number], zoom: SINGLE_POINT_ZOOM });
    else if (bounds) cameraRef.current?.fitBounds(bounds, { padding: FIT_PADDING, duration: 0 });
  }, [bounds, shown]);

  const handleMapReady = useCallback(() => {
    mapReadyRef.current = true;
    fitToRoute();
  }, [fitToRoute]);

  useEffect(() => {
    fitToRoute();
  }, [fitToRoute]);

  return (
    <View style={s.container}>
      <Map
        style={StyleSheet.absoluteFill}
        showsUserLocation={false}
        contentReady={!isLoading}
        onDidFinishLoadingMap={handleMapReady}
      >
        <Camera ref={cameraRef} initialViewState={initialViewFor(bounds, FIT_PADDING)} />
        {path.length > 1 && (
          <GeoJSONSource id={`${idPrefix}-route`} data={lineShape}>
            <Layer
              type="line"
              id={`${lineLayerId}-casing`}
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={routeCasingPaint(5)}
            />
            <Layer
              type="line"
              id={lineLayerId}
              layout={{ "line-join": "round", "line-cap": "round" }}
              paint={{ "line-color": ROUTE_LINE_COLOR, "line-width": 5 }}
            />
          </GeoJSONSource>
        )}
        {path.length > 0 && (
          <StartMarker id={`${idPrefix}-start`} position={path[0]} label={t("map.start")} onPress={openDirections} />
        )}
        {meetingPoint && (
          <StartMarker
            id={`${idPrefix}-meeting`}
            position={meetingPoint.position}
            label={meetingPoint.label}
            onPress={() => openDirectionsToStart(meetingPoint.position, t, meetingPoint.directionsMessage)}
          />
        )}
        {userLocation && (
          <UserLocationMarker
            // keep-comment: remount, not mutate, when the anchor appears (see UserLocationMarker)
            key={puckAnchor ?? "no-anchor"}
            id={`${idPrefix}-user`}
            position={userLocation.position}
            heading={userLocation.heading}
            aboveLayerId={puckAnchor}
          />
        )}
      </Map>

      <MapBackChip title={title} />

      <MapStatusOverlay errorMessage={isLoading ? undefined : errorMessage} />

      <CenterOnUserButton cameraRef={cameraRef} position={userLocation?.position ?? null} />
      <BasemapToggle />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
});
