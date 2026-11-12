// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import Map from "@/components/map/map";
import MapPreviewOverlay from "@/components/map/map-preview-overlay";
import { BORDER_RADIUS, SCREEN_PADDING } from "@/constants/constants";
import { CityArea } from "@/data/types";
import { areaMapShapes } from "@/utils/area/area-map-shapes";
import { Camera, type CameraRef } from "@maplibre/maplibre-react-native";
import { ReactNode, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "react-native-paper";
import AreaMapLayers from "./area-map-layers";
import AreaMapLegend from "./area-map-legend";

const MAP_HEIGHT = 220;
const PADDING = 24;
// keep-comment: the page scrolls, so the map does not take pan or zoom gestures
const STATIC_GESTURES = {
  dragPan: false,
  touchZoom: false,
  touchRotate: false,
  touchPitch: false,
  doubleTapZoom: false,
} as const;

interface Props {
  area: CityArea;
  onOpen: () => void;
  // keep-comment: shown above the map, and left out with it when the area has nothing to draw
  heading?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function AreaMap({ area, onOpen, heading, style }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const cameraRef = useRef<CameraRef>(null);
  const shapes = useMemo(() => areaMapShapes(area), [area]);

  const frame = useCallback(() => {
    if (shapes.bounds) {
      cameraRef.current?.fitBounds(shapes.bounds, {
        padding: { top: PADDING, right: PADDING, bottom: PADDING, left: PADDING },
        duration: 0,
      });
    }
  }, [shapes.bounds]);

  if (!shapes.bounds) return null;

  return (
    <View style={style}>
      {heading}
      <View testID="area-map" style={s.wrap}>
        <View style={[s.map, { borderColor: theme.colors.outlineVariant }]}>
          <Map
            style={s.fill}
            showsUserLocation={false}
            attributionPosition={{ top: SCREEN_PADDING, left: SCREEN_PADDING }}
            onDidFinishLoadingMap={frame}
            {...STATIC_GESTURES}
          >
            <Camera ref={cameraRef} />
            <AreaMapLayers shapes={shapes} />
          </Map>
          <MapPreviewOverlay label={t("area.openMap")} onPress={onOpen} />
        </View>
        <AreaMapLegend shapes={shapes} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    gap: 10,
    paddingHorizontal: SCREEN_PADDING,
  },
  map: {
    height: MAP_HEIGHT,
    borderRadius: BORDER_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  fill: {
    flex: 1,
  },
});
