// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import Map from "@/components/map/map";
import MapPreviewOverlay from "@/components/map/map-preview-overlay";
import { ROUTE_LINE_COLOR, routeCasingPaint } from "@/components/map/marker-styles";
import StartMarker from "@/components/map/start-marker";
import { SCREEN_PADDING } from "@/constants/constants";
import { lineStringFromPositions, lngLat } from "@/utils/geo/geojson";
import getBoundsFromTrail from "@/utils/geo/get-bounds-from-trail";
import { SINGLE_POINT_ZOOM, initialViewFor } from "@/utils/map/initial-view";
import { MeetingPoint, openDirectionsToStart } from "@/utils/map/open-directions";
import { Camera, type CameraRef, GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useCallback, useMemo, useRef } from "react";
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";

const FIT_PADDING = { top: 20, right: 20, bottom: 20, left: 20 };
// keep-comment: a tappable preview cannot pan; the full-cover Pressable would swallow the drag
const STATIC_GESTURES = {
  dragPan: false,
  touchZoom: false,
  touchRotate: false,
  touchPitch: false,
  doubleTapZoom: false,
} as const;

interface Props {
  idPrefix: string;
  path: GeoJSON.Position[];
  // keep-comment: makes the preview a button and stops it panning; omitted for a share awaiting a decision
  onOpen?: () => void;
  label?: string;
  showDirections?: boolean;
  // keep-comment: false keeps the full-cover Pressable, since the map swallows touches and the parent would never see the tap
  showBadge?: boolean;
  meetingPoint?: MeetingPoint;
  style?: StyleProp<ViewStyle>;
}

export default function RoutePreviewMap({
  idPrefix,
  path,
  onOpen,
  label,
  showDirections = true,
  showBadge = true,
  meetingPoint,
  style,
}: Props) {
  const cameraRef = useRef<CameraRef>(null);
  const { t } = useTranslation();

  const routeShape = useMemo(() => lineStringFromPositions(path), [path]);
  const shown = useMemo(() => (meetingPoint ? [...path, meetingPoint.position] : path), [path, meetingPoint]);
  const bounds = useMemo(() => getBoundsFromTrail(shown), [shown]);
  const start = path[0];
  const target = meetingPoint?.position ?? start;

  const handleMapReady = useCallback(() => {
    const [only] = shown;
    // fitBounds zooms a single point to the maximum. keep-comment: MapLibre edge case
    if (shown.length === 1 && only) cameraRef.current?.jumpTo({ center: lngLat(only), zoom: SINGLE_POINT_ZOOM });
    else if (bounds) cameraRef.current?.fitBounds(bounds, { padding: FIT_PADDING, duration: 0 });
  }, [bounds, shown]);

  return (
    <View testID="route-preview" style={style}>
      {shown.length > 0 && (
        <Map
          style={s.map}
          showsUserLocation={false}
          // keep-comment: top-left, since the overlay's pills hold both bottom corners
          attributionPosition={{ top: SCREEN_PADDING, left: SCREEN_PADDING }}
          onDidFinishLoadingMap={handleMapReady}
          {...(onOpen ? STATIC_GESTURES : {})}
        >
          <Camera ref={cameraRef} initialViewState={initialViewFor(bounds, FIT_PADDING)} />
          {path.length > 1 && (
            <GeoJSONSource id={`${idPrefix}-route`} data={routeShape}>
              <Layer
                type="line"
                id={`${idPrefix}-route-casing`}
                layout={{ "line-join": "round", "line-cap": "round" }}
                paint={routeCasingPaint(3)}
              />
              <Layer
                type="line"
                id={`${idPrefix}-route-line`}
                layout={{ "line-join": "round", "line-cap": "round" }}
                paint={{ "line-color": ROUTE_LINE_COLOR, "line-width": 3 }}
              />
            </GeoJSONSource>
          )}
          {start && (
            <StartMarker
              id={`${idPrefix}-start`}
              position={start}
              label={t("map.start")}
              // keep-comment: with an overlay its pill gives directions; the cover would swallow this tap
              onPress={onOpen ? undefined : () => openDirectionsToStart(start, t)}
            />
          )}
          {meetingPoint && (
            <StartMarker
              id={`${idPrefix}-meeting`}
              position={meetingPoint.position}
              label={meetingPoint.label}
              onPress={
                onOpen
                  ? undefined
                  : () => openDirectionsToStart(meetingPoint.position, t, meetingPoint.directionsMessage)
              }
            />
          )}
        </Map>
      )}
      {onOpen &&
        shown.length > 0 &&
        (showBadge ? (
          <MapPreviewOverlay
            label={label ?? t("map.showMapView")}
            onPress={onOpen}
            startPosition={showDirections ? target : undefined}
            directionsMessage={meetingPoint?.directionsMessage}
          />
        ) : (
          <Pressable
            testID="route-preview-cover"
            style={StyleSheet.absoluteFill}
            onPress={onOpen}
            accessibilityRole="button"
          />
        ))}
    </View>
  );
}

const s = StyleSheet.create({
  map: {
    flex: 1,
  },
});
