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
import { MeetingPoint, openDirectionsToStart } from "@/utils/map/open-directions";
import { Camera, type CameraRef, GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

// The fullscreen "follow" view: one route drawn cleanly with the user's live position,
// nothing else (no clusters, other trails or facility pins). Shared by the trail follow
// screen and the hike follow screen so the two can't drift apart visually — each of
// those owns only its own data fetching and passes the finished path in here.
const FIT_PADDING = { top: 100, right: 60, bottom: 120, left: 60 };
// Zoom used when a route has a single point, where bounds are a zero-area box.
const SINGLE_POINT_ZOOM = 15;

interface Props {
  // Unique prefix for this view's map source/layer ids.
  idPrefix: string;
  // The route to walk, as [longitude, latitude] positions.
  path: GeoJSON.Position[];
  // Shown on the surface beside the back button.
  title?: string;
  isLoading?: boolean;
  // Shown centred when the route could not be loaded. Mutually exclusive with isLoading.
  errorMessage?: string;
  meetingPoint?: MeetingPoint;
}

export default function RouteFollowView({ idPrefix, path, title, isLoading, errorMessage, meetingPoint }: Props) {
  const { t } = useTranslation();

  const cameraRef = useRef<CameraRef>(null);
  const mapReadyRef = useRef(false);

  // The puck is driven by the app's own location watcher, not MapLibre's built-in
  // engine, which freezes the dot mid-walk on both platforms (see the hook).
  const userLocation = useLiveUserLocation();

  const lineShape = useMemo(() => lineStringFromPositions(path), [path]);
  const shown = useMemo(() => (meetingPoint ? [...path, meetingPoint.position] : path), [path, meetingPoint]);
  const bounds = useMemo(() => getBoundsFromTrail(shown), [shown]);

  const lineLayerId = `${idPrefix}-route-line`;
  // The layer the puck is pinned above — but only once that layer actually exists. The
  // route is rendered conditionally below, and the GPS fix usually lands before the
  // coordinates do, so naming an anchor unconditionally would leave the puck waiting on
  // a layer that might never appear.
  //
  // Anchor to the start marker's *label* (its topmost layer), not the route line: the
  // marker is mounted after the line and so ends up above it, and anchoring to the line
  // buries the puck under the trailhead circle — where you are standing when you set off.
  // A one-point route still has a marker, so this covers that case too.
  const puckAnchor = path.length > 0 ? `${idPrefix}-start-label` : undefined;

  // Tapping the trailhead hands off to the device's maps app for directions.
  const openDirections = useCallback(() => {
    if (path.length > 0) openDirectionsToStart(path[0], t);
  }, [path, t]);

  // Fit to the route once both the map and the coordinates are ready — whichever
  // arrives last triggers the fit (map-ready callback, or this effect on bounds).
  const fitToRoute = useCallback(() => {
    if (!mapReadyRef.current) return;
    // A single point has a zero-area bounding box, which fitBounds resolves to maximum
    // zoom; centre on it at a sane level instead.
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
      <Map style={StyleSheet.absoluteFill} showsUserLocation={false} onDidFinishLoadingMap={handleMapReady}>
        <Camera ref={cameraRef} />
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
            // Remount instead of mutating when the anchor appears. Changing
            // aboveLayerId in place makes the native side remove the layer and re-add
            // the same object, and it dereferences the new anchor with `!!` — see the
            // prop's docs in UserLocationMarker.
            key={puckAnchor ?? "no-anchor"}
            id={`${idPrefix}-user`}
            position={userLocation.position}
            heading={userLocation.heading}
            aboveLayerId={puckAnchor}
          />
        )}
      </Map>

      <MapBackChip title={title} />

      <MapStatusOverlay isLoading={isLoading} errorMessage={errorMessage} />

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
