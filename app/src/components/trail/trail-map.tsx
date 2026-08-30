// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { lineStringFromPositions } from "@/utils/geojson";
import getBoundsFromTrail from "@/utils/get-bounds-from-trail";
import { Camera, type CameraRef, GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useCallback, useMemo, useRef } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Surface } from "react-native-paper";
import Map from "../map/map";
import MapPreviewOverlay from "../map/map-preview-overlay";
import { ROUTE_LINE_COLOR } from "../map/marker-styles";
import StartMarker from "../map/start-marker";

interface TrailMapProps {
  trail: GeoJSON.Position[];
  onPress: () => void;
}

const HEIGHT = Dimensions.get("screen").height;

// Static map preview on the trail detail screen: shows the route and the user's
// position, but is not pannable — the whole surface is a button that opens the
// fullscreen follow view (the map itself is the entry point).
export default function TrailMap({ trail, onPress }: TrailMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const { t } = useTranslation();

  const bounds = useMemo(() => getBoundsFromTrail(trail), [trail]);
  const center = useMemo<[number, number] | undefined>(
    () => (bounds ? [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2] : undefined),
    [bounds],
  );
  const lineShape = useMemo(() => lineStringFromPositions(trail), [trail]);

  const fitToTrail = useCallback(() => {
    if (bounds)
      cameraRef.current?.fitBounds(bounds, { padding: { top: 40, right: 40, bottom: 40, left: 40 }, duration: 0 });
  }, [bounds]);

  return (
    <Surface style={s.container}>
      <View style={s.inner}>
        {trail.length > 0 && (
          <Map
            style={s.map}
            showsUserLocation
            // Top-left instead of the fullscreen default: the bottom corners hold the
            // overlay's two pills, and the safe-area inset has nothing to clear here.
            attributionPosition={{ top: SCREEN_PADDING, left: SCREEN_PADDING }}
            dragPan={false}
            touchZoom={false}
            touchRotate={false}
            touchPitch={false}
            doubleTapZoom={false}
            onDidFinishLoadingMap={fitToTrail}
          >
            <Camera ref={cameraRef} initialViewState={center ? { center, zoom: 12 } : undefined} />
            {trail.length > 1 && (
              <GeoJSONSource id="trail-route" data={lineShape}>
                <Layer
                  type="line"
                  id="trail-route-line"
                  layout={{ "line-join": "round", "line-cap": "round" }}
                  paint={{ "line-color": ROUTE_LINE_COLOR, "line-width": 3 }}
                />
              </GeoJSONSource>
            )}
            {trail.length > 0 && <StartMarker id="trail-start" position={trail[0]} label={t("map.start")} />}
          </Map>
        )}
        <MapPreviewOverlay
          label={t("map.showOnMap")}
          onPress={onPress}
          startPosition={trail.length > 0 ? trail[0] : undefined}
        />
      </View>
    </Surface>
  );
}

const s = StyleSheet.create({
  container: {
    height: HEIGHT * 0.3,
    borderRadius: SURFACE_BORDER_RADIUS,
  },
  inner: {
    flex: 1,
    borderRadius: SURFACE_BORDER_RADIUS,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
});
