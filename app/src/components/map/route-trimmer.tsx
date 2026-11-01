// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import Map from "@/components/map/map";
import { routeCasingPaint } from "@/components/map/marker-styles";
import { BORDER_RADIUS } from "@/constants/constants";
import { formatDistanceKm } from "@/utils/format-distance";
import { lineStringFromPositions } from "@/utils/geojson";
import getBoundsFromTrail from "@/utils/get-bounds-from-trail";
import { haversineDistance } from "@/utils/haversine";
import { Camera, type CameraRef, GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { Slider } from "@miblanchard/react-native-slider";
import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export type TrimRange = [start: number, end: number];

export function lengthOfPath(path: GeoJSON.Position[]): number {
  let metres = 0;
  for (let i = 1; i < path.length; i++) {
    metres += haversineDistance(path[i - 1][1], path[i - 1][0], path[i][1], path[i][0]);
  }
  return metres;
}

export function fullRange(path: GeoJSON.Position[]): TrimRange {
  return [0, Math.max(0, path.length - 1)];
}

// The kept part of a path, inclusive at both ends. keep-comment: matches the backend's PathTrim
export function trimmedPath(path: GeoJSON.Position[], trim: TrimRange): GeoJSON.Position[] {
  return path.slice(trim[0], trim[1] + 1);
}

// The trim as request indices: null where the path is kept to its end. keep-comment: the backend reads null as untrimmed
export function trimIndices(path: GeoJSON.Position[], trim: TrimRange): { start: number | null; end: number | null } {
  const lastIndex = Math.max(0, path.length - 1);
  return { start: trim[0] > 0 ? trim[0] : null, end: trim[1] < lastIndex ? trim[1] : null };
}

function toRange(value: number[]): TrimRange {
  const [start, end] = value;
  return [Math.round(Math.min(start, end)), Math.round(Math.max(start, end))];
}

type Props = {
  idPrefix: string;
  path: GeoJSON.Position[];
  trim: TrimRange;
  onTrimChange: (trim: TrimRange) => void;
  testID?: string;
};

export default function RouteTrimmer({ idPrefix, path, trim, onTrimChange, testID }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const cameraRef = useRef<CameraRef>(null);

  // The drag stays local and reaches the caller on release; the map follows a deferred copy. keep-comment: each tick would rebuild and resend the route's GeoJSON
  const [dragging, setDragging] = useState<TrimRange | null>(null);
  const shown = useDeferredValue(dragging ?? trim);

  const lastIndex = Math.max(0, path.length - 1);
  const kept = useMemo(() => trimmedPath(path, shown), [path, shown]);
  const keptMetres = useMemo(() => lengthOfPath(kept), [kept]);
  const fullShape = useMemo(() => lineStringFromPositions(path), [path]);
  const keptShape = useMemo(() => lineStringFromPositions(kept), [kept]);
  const bounds = useMemo(() => getBoundsFromTrail(path), [path]);
  const fitToRoute = useCallback(() => {
    if (bounds)
      cameraRef.current?.fitBounds(bounds, { padding: { top: 30, right: 30, bottom: 30, left: 30 }, duration: 0 });
  }, [bounds]);

  return (
    <View testID={testID} style={s.section}>
      {path.length > 1 && (
        <View style={s.mapContainer}>
          {/* keep-comment: a SurfaceView lags behind the keyboard lift and leaves a stale copy of the map */}
          <Map style={s.map} androidView="texture" showsUserLocation={false} onDidFinishLoadingMap={fitToRoute}>
            <Camera ref={cameraRef} />
            <GeoJSONSource id={`${idPrefix}-route-full`} data={fullShape}>
              <Layer
                type="line"
                id={`${idPrefix}-route-full-line`}
                layout={{ "line-join": "round", "line-cap": "round" }}
                paint={{ "line-color": theme.colors.outline, "line-width": 3, "line-dasharray": [2, 2] }}
              />
            </GeoJSONSource>
            {kept.length > 1 && (
              <GeoJSONSource id={`${idPrefix}-route-kept`} data={keptShape}>
                <Layer
                  type="line"
                  id={`${idPrefix}-route-kept-casing`}
                  layout={{ "line-join": "round", "line-cap": "round" }}
                  paint={routeCasingPaint(4)}
                />
                <Layer
                  type="line"
                  id={`${idPrefix}-route-kept-line`}
                  layout={{ "line-join": "round", "line-cap": "round" }}
                  paint={{ "line-color": theme.colors.primary, "line-width": 4 }}
                />
              </GeoJSONSource>
            )}
          </Map>
        </View>
      )}
      {path.length > 2 && (
        <Slider
          value={dragging ?? trim}
          minimumValue={0}
          maximumValue={lastIndex}
          step={1}
          minimumTrackTintColor={theme.colors.primary}
          maximumTrackTintColor={theme.colors.outline}
          thumbTintColor={theme.colors.primary}
          onValueChange={(value) => setDragging(toRange(value))}
          onSlidingComplete={(value) => {
            setDragging(null);
            onTrimChange(toRange(value));
          }}
        />
      )}
      <Text testID={`${idPrefix}-length`} variant="bodySmall">
        {t("publish.newLength", { length: formatDistanceKm(keptMetres / 1000) })}
      </Text>
      {kept.length < 2 && <Text style={[s.errorText, { color: theme.colors.error }]}>{t("publish.trimTooShort")}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    gap: 8,
  },
  mapContainer: {
    height: 200,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    paddingLeft: 4,
  },
});
