// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import {
  MARKER_COLORS,
  ROUTE_LINE_COLOR,
  SWIMMING_MARKER_COLORS,
  routeCasingPaint,
} from "@/components/map/marker-styles";
import { AreaMapShapes, MapFacilityKind } from "@/utils/area/area-map-shapes";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";

export const AREA_DOT_COLORS: Record<Exclude<MapFacilityKind, "other">, string> = {
  swimming: SWIMMING_MARKER_COLORS.fill,
  firePit: MARKER_COLORS.firePits.fill,
  shelter: MARKER_COLORS.shelters.fill,
};

// keep-comment: the id of the topmost layer, for a puck drawn above everything
export const AREA_TOP_LAYER = "area-facilities-dots";

interface Props {
  shapes: AreaMapShapes;
  lineWidth: number;
}

export default function AreaMapLayers({ shapes, lineWidth }: Props) {
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
      <GeoJSONSource id="area-trails" data={shapes.trails}>
        <Layer
          type="line"
          id="area-trails-casing"
          layout={{ "line-join": "round", "line-cap": "round" }}
          paint={routeCasingPaint(lineWidth)}
        />
        <Layer
          type="line"
          id="area-trails-line"
          layout={{ "line-join": "round", "line-cap": "round" }}
          paint={{ "line-color": ROUTE_LINE_COLOR, "line-width": lineWidth }}
        />
      </GeoJSONSource>
      <GeoJSONSource id="area-facilities" data={shapes.facilities}>
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
