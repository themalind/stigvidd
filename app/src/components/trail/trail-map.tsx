// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { lineStringFromPositions } from "@/utils/geo/geojson";
import getBoundsFromTrail from "@/utils/geo/get-bounds-from-trail";
import { initialViewFor } from "@/utils/map/initial-view";
import { Camera, type CameraRef, GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useCallback, useMemo, useRef } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Surface } from "react-native-paper";
import Map from "../map/map";
import MapPreviewOverlay from "../map/map-preview-overlay";
import { ROUTE_LINE_COLOR, routeCasingPaint } from "../map/marker-styles";
import StartMarker from "../map/start-marker";

interface TrailMapProps {
  trail: GeoJSON.Position[];
  onPress: () => void;
}

const HEIGHT = Dimensions.get("screen").height;
const FIT_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };

export default function TrailMap({ trail, onPress }: TrailMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const { t } = useTranslation();

  const bounds = useMemo(() => getBoundsFromTrail(trail), [trail]);
  const lineShape = useMemo(() => lineStringFromPositions(trail), [trail]);
  const start = trail[0];

  const fitToTrail = useCallback(() => {
    if (bounds) cameraRef.current?.fitBounds(bounds, { padding: FIT_PADDING, duration: 0 });
  }, [bounds]);

  return (
    <Surface style={s.container}>
      <View style={s.inner}>
        {trail.length > 0 && (
          <Map
            style={s.map}
            showsUserLocation
            // keep-comment: top-left, since the overlay's pills hold both bottom corners
            attributionPosition={{ top: SCREEN_PADDING, left: SCREEN_PADDING }}
            dragPan={false}
            touchZoom={false}
            touchRotate={false}
            touchPitch={false}
            doubleTapZoom={false}
            onDidFinishLoadingMap={fitToTrail}
          >
            <Camera ref={cameraRef} initialViewState={initialViewFor(bounds, FIT_PADDING)} />
            {trail.length > 1 && (
              <GeoJSONSource id="trail-route" data={lineShape}>
                <Layer
                  type="line"
                  id="trail-route-casing"
                  layout={{ "line-join": "round", "line-cap": "round" }}
                  paint={routeCasingPaint(3)}
                />
                <Layer
                  type="line"
                  id="trail-route-line"
                  layout={{ "line-join": "round", "line-cap": "round" }}
                  paint={{ "line-color": ROUTE_LINE_COLOR, "line-width": 3 }}
                />
              </GeoJSONSource>
            )}
            {start && <StartMarker id="trail-start" position={start} label={t("map.start")} />}
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
