// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import {
  type CircleLayerSpecification,
  type FilterSpecification,
  GeoJSONSource,
  type GeoJSONSourceRef,
  Layer,
  type PressEventWithFeatures,
} from "@maplibre/maplibre-react-native";
import { RefObject } from "react";
import { NativeSyntheticEvent } from "react-native";
import { type ClusterActionConfig } from "./cluster-action";
import { type MarkerColors } from "./marker-styles";

// keep-comment: clustered up to a high zoom so overlapping trailheads stay one tappable cluster instead of stacked pins
export const CLUSTER_MAX_ZOOM = 16;

// keep-comment: up to this many points a cluster is usually trails sharing a trailhead, so it opens the carousel instead of zooming
export const TRAIL_CLUSTER_ACTION: ClusterActionConfig = { clusterMaxZoom: CLUSTER_MAX_ZOOM, carouselMaxCount: 10 };

export const POINT_RADIUS = 9;
export const FACILITY_POINT_RADIUS = 6;
const CLUSTER_RADIUS_BASE = 16;
const CLUSTER_RADIUS_MED = 20;
const CLUSTER_RADIUS_LARGE = 26;
const CLUSTER_COUNT_MED = 10;
const CLUSTER_COUNT_LARGE = 50;

const HAS_COUNT: FilterSpecification = ["has", "point_count"];
const NO_COUNT: FilterSpecification = ["!", ["has", "point_count"]];

// keep-comment: the one cluster size step, read by the cluster layer and markerRadius
const CLUSTER_RADIUS: Extract<NonNullable<CircleLayerSpecification["paint"]>["circle-radius"], unknown[]> = [
  "step",
  ["get", "point_count"],
  CLUSTER_RADIUS_BASE,
  CLUSTER_COUNT_MED,
  CLUSTER_RADIUS_MED,
  CLUSTER_COUNT_LARGE,
  CLUSTER_RADIUS_LARGE,
];

// keep-comment: a null pointCount is a single trail point; otherwise mirrors CLUSTER_RADIUS
export function markerRadius(pointCount: number | null): number {
  if (pointCount == null) return POINT_RADIUS;
  if (pointCount >= CLUSTER_COUNT_LARGE) return CLUSTER_RADIUS_LARGE;
  if (pointCount >= CLUSTER_COUNT_MED) return CLUSTER_RADIUS_MED;
  return CLUSTER_RADIUS_BASE;
}

interface Props {
  id: string;
  data: GeoJSON.FeatureCollection<GeoJSON.Point>;
  colors: MarkerColors;
  pointRadius: number;
  sourceRef: RefObject<GeoJSONSourceRef | null>;
  onPress?: (
    event: NativeSyntheticEvent<PressEventWithFeatures>,
    sourceRef: RefObject<GeoJSONSourceRef | null>,
  ) => void;
}

// keep-comment: one source per marker category, so categories never merge into one cluster and all break apart at the same zooms
export default function ClusterSource({ id, data, colors, pointRadius, sourceRef, onPress }: Props) {
  return (
    <GeoJSONSource
      id={id}
      ref={sourceRef}
      data={data}
      cluster
      clusterRadius={60}
      clusterMaxZoom={CLUSTER_MAX_ZOOM}
      {...(onPress
        ? { onPress: (event: NativeSyntheticEvent<PressEventWithFeatures>) => onPress(event, sourceRef) }
        : {})}
    >
      <Layer
        type="circle"
        id={`${id}-clusters`}
        filter={HAS_COUNT}
        paint={{
          "circle-color": colors.fill,
          "circle-radius": CLUSTER_RADIUS,
          "circle-stroke-width": 2,
          "circle-stroke-color": colors.stroke,
        }}
      />
      <Layer
        type="symbol"
        id={`${id}-cluster-count`}
        filter={HAS_COUNT}
        layout={{
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
          // keep-comment: clusters from different sources can overlap, and a collided count would leave its circle blank
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        }}
        paint={{ "text-color": colors.stroke }}
      />
      <Layer
        type="circle"
        id={`${id}-points`}
        filter={NO_COUNT}
        paint={{
          "circle-color": colors.fill,
          "circle-radius": pointRadius,
          "circle-stroke-width": 2,
          "circle-stroke-color": colors.stroke,
        }}
      />
    </GeoJSONSource>
  );
}
