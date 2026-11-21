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
import ObstacleMarkers from "@/components/map/obstacle-markers";
import StartMarker from "@/components/map/start-marker";
import UserLocationMarker from "@/components/map/user-location-marker";
import ObstacleMapCarousel from "@/components/trail/obstacle/obstacle-map-carousel";
import { SCREEN_PADDING } from "@/constants/constants";
import { TrailObstacle } from "@/data/types";
import { useLiveUserLocation } from "@/hooks/location/useLiveUserLocation";
import { lineStringFromPositions } from "@/utils/geo/geojson";
import getBoundsFromTrail from "@/utils/geo/get-bounds-from-trail";
import { SINGLE_POINT_ZOOM, initialViewFor } from "@/utils/map/initial-view";
import { MeetingPoint, openDirectionsToStart } from "@/utils/map/open-directions";
import { Camera, type CameraRef, GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

// Shared by trail and hike follow so the two cannot drift apart; each passes in its own path. keep-comment: why shared
const FIT_PADDING = { top: 100, right: 60, bottom: 120, left: 60 };

export interface FollowObstacles {
  trailIdentifier: string;
  items: TrailObstacle[];
}

interface ObstacleSelection {
  // keep-comment: every obstacle under the finger, so stacked pins open as one carousel
  tapped: string[];
  // keep-comment: the card the carousel has settled on; its pin is drawn enlarged
  activeId?: string;
  // keep-comment: the carousel's covered height, gone with it when it closes
  coveredHeight?: number;
}

interface Props {
  idPrefix: string;
  // [longitude, latitude] keep-comment: GeoJSON order, easy to swap
  path: GeoJSON.Position[];
  title?: string;
  isLoading?: boolean;
  errorMessage?: string;
  meetingPoint?: MeetingPoint;
  obstacles?: FollowObstacles;
}

export default function RouteFollowView({
  idPrefix,
  path,
  title,
  isLoading,
  errorMessage,
  meetingPoint,
  obstacles,
}: Props) {
  const { t } = useTranslation();

  const cameraRef = useRef<CameraRef>(null);
  const mapReadyRef = useRef(false);

  const [selection, setSelection] = useState<ObstacleSelection | null>(null);
  const tapped = selection?.tapped;
  const shownObstacles = useMemo(
    () => (tapped && obstacles ? obstacles.items.filter((o) => tapped.includes(o.identifier)) : []),
    [tapped, obstacles],
  );

  // keep-comment: resolved or deleted obstacles close the carousel, and it stays closed if a later refetch brings them back
  if (selection && shownObstacles.length === 0) setSelection(null);

  const activeObstacleId =
    shownObstacles.find((o) => o.identifier === selection?.activeId)?.identifier ??
    shownObstacles[0]?.identifier ??
    null;

  // keep-comment: a tap starts the carousel at its first card; it stays mounted across taps, so its last
  // keep-comment: height still holds until it measures again
  const selectObstacles = useCallback((identifiers: string[]) => {
    setSelection((current) => ({ tapped: identifiers, coveredHeight: current?.coveredHeight }));
  }, []);
  const showObstacle = useCallback((activeId: string) => {
    setSelection((current) => (current && current.activeId !== activeId ? { ...current, activeId } : current));
  }, []);
  const measureCarousel = useCallback((coveredHeight: number) => {
    setSelection((current) => current && { ...current, coveredHeight });
  }, []);
  const clearObstacle = useCallback(() => setSelection(null), []);

  // Our own watcher, since MapLibre's engine freezes the puck mid-walk. keep-comment: platform bug
  const userLocation = useLiveUserLocation();

  const lineShape = useMemo(() => lineStringFromPositions(path), [path]);
  const shown = useMemo(() => (meetingPoint ? [...path, meetingPoint.position] : path), [path, meetingPoint]);
  const bounds = useMemo(() => getBoundsFromTrail(shown), [shown]);

  const lineLayerId = `${idPrefix}-route-line`;
  // Named only once the route exists: the GPS fix usually arrives first, and the puck would wait on a missing layer. keep-comment: race
  // The start label, not the line, so the puck is not buried under the trailhead you stand on. keep-comment: layer order
  const puckAnchor = path.length > 0 ? `${idPrefix}-start-label` : undefined;
  // keep-comment: directly above the line, so the start marker and the puck, added later, stay on top of the pins
  const obstacleAnchor = path.length > 1 ? lineLayerId : undefined;

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
        onPress={clearObstacle}
        // keep-comment: the licence requires the attribution and MapTiler logo visible, so they move above an open card
        attributionPosition={{
          bottom: selection?.coveredHeight ?? SCREEN_PADDING,
          left: SCREEN_PADDING,
        }}
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
        {obstacles && (
          <ObstacleMarkers
            // keep-comment: remount, not mutate, when the anchor appears (see ObstacleMarkers)
            key={obstacleAnchor ?? "no-anchor"}
            aboveLayerId={obstacleAnchor}
            id={`${idPrefix}-obstacles`}
            obstacles={obstacles.items}
            selectedIdentifier={activeObstacleId}
            onSelect={selectObstacles}
          />
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

      {obstacles && shownObstacles.length > 0 ? (
        <ObstacleMapCarousel
          obstacles={shownObstacles}
          opening={selection?.tapped}
          trailIdentifier={obstacles.trailIdentifier}
          onClose={clearObstacle}
          onActiveChange={showObstacle}
          onMeasure={measureCarousel}
        />
      ) : (
        <>
          <CenterOnUserButton cameraRef={cameraRef} position={userLocation?.position ?? null} />
          <BasemapToggle />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
});
