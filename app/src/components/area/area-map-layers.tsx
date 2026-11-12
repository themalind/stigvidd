// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { MARKER_COLORS, ROUTE_LINE_COLOR, SWIMMING_MARKER_COLORS } from "@/components/map/marker-styles";
import { AreaMapShapes, MapFacilityKind } from "@/utils/area/area-map-shapes";
import { GeoJSONSource, Layer, type PressEventWithFeatures } from "@maplibre/maplibre-react-native";
import { NativeSyntheticEvent } from "react-native";

type PressEvent = NativeSyntheticEvent<PressEventWithFeatures>;

const TRAIL_RADIUS = 9;

export const AREA_DOT_COLORS: Record<Exclude<MapFacilityKind, "other">, string> = {
  swimming: SWIMMING_MARKER_COLORS.fill,
  firePit: MARKER_COLORS.firePits.fill,
  shelter: MARKER_COLORS.shelters.fill,
};

// keep-comment: the id of the topmost layer, for a puck drawn above everything
export const AREA_TOP_LAYER = "area-facilities-dots";

interface Props {
  shapes: AreaMapShapes;
  // keep-comment: every trail under the finger, so trails sharing a trailhead open together as on the map tab
  onTrailPress?: (identifiers: string[]) => void;
  onFacilityPress?: (name: string, coordinates: [number, number]) => void;
}

function handleTrailPress(event: PressEvent, onTrailPress: (identifiers: string[]) => void) {
  event.stopPropagation();
  const identifiers = (event.nativeEvent.features ?? [])
    .map((feature) => feature.properties?.identifier as string | undefined)
    .filter((identifier): identifier is string => !!identifier);
  if (identifiers.length > 0) onTrailPress([...new Set(identifiers)]);
}

function handleFacilityPress(
  event: PressEvent,
  onFacilityPress: (name: string, coordinates: [number, number]) => void,
) {
  event.stopPropagation();
  const feature = event.nativeEvent.features?.[0];
  const name = feature?.properties?.name as string | undefined;
  if (!feature || !name) return;
  const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
  onFacilityPress(name, [lng, lat]);
}

export default function AreaMapLayers({ shapes, onTrailPress, onFacilityPress }: Props) {
  return (
    <>
      <GeoJSONSource id="area-boundary" data={shapes.boundary}>
        <Layer type="fill" id="area-boundary-fill" paint={{ "fill-color": ROUTE_LINE_COLOR, "fill-opacity": 0.06 }} />
        <Layer
          type="line"
          id="area-boundary-line"
          paint={{ "line-color": ROUTE_LINE_COLOR, "line-width": 2, "line-dasharray": [3, 2] }}
        />
      </GeoJSONSource>
      <GeoJSONSource
        id="area-trails"
        data={shapes.trails}
        {...(onTrailPress ? { onPress: (event: PressEvent) => handleTrailPress(event, onTrailPress) } : {})}
      >
        <Layer
          type="circle"
          id="area-trails-points"
          paint={{
            "circle-color": MARKER_COLORS.trails.fill,
            "circle-radius": TRAIL_RADIUS,
            "circle-stroke-width": 2,
            "circle-stroke-color": MARKER_COLORS.trails.stroke,
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource
        id="area-facilities"
        data={shapes.facilities}
        {...(onFacilityPress ? { onPress: (event: PressEvent) => handleFacilityPress(event, onFacilityPress) } : {})}
      >
        <Layer
          type="circle"
          id={AREA_TOP_LAYER}
          filter={["!=", ["get", "kind"], "other"]}
          paint={{
            "circle-radius": 6,
            "circle-color": [
              "match",
              ["get", "kind"],
              "swimming",
              AREA_DOT_COLORS.swimming,
              "shelter",
              AREA_DOT_COLORS.shelter,
              AREA_DOT_COLORS.firePit,
            ],
            "circle-stroke-color": SWIMMING_MARKER_COLORS.stroke,
            "circle-stroke-width": 2,
          }}
        />
      </GeoJSONSource>
    </>
  );
}
