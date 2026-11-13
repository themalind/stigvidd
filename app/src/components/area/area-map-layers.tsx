// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { decideClusterAction } from "@/components/map/cluster-action";
import ClusterSource, {
  CLUSTER_MAX_ZOOM,
  FACILITY_POINT_RADIUS,
  POINT_RADIUS,
  TRAIL_CLUSTER_ACTION,
} from "@/components/map/cluster-source";
import {
  MARKER_COLORS,
  type MarkerColors,
  ROUTE_LINE_COLOR,
  SWIMMING_MARKER_COLORS,
} from "@/components/map/marker-styles";
import { AreaMapShapes, MapFacilityKind } from "@/utils/area/area-map-shapes";
import {
  GeoJSONSource,
  type GeoJSONSourceRef,
  Layer,
  type PressEventWithFeatures,
} from "@maplibre/maplibre-react-native";
import { RefObject, useCallback, useMemo, useRef } from "react";
import { type AreaMapFilter, FILTER_KEY_OF_KIND, SHOW_ALL_IN_AREA } from "./area-map-filter";
import { useTranslation } from "react-i18next";
import { NativeSyntheticEvent } from "react-native";

type PressEvent = NativeSyntheticEvent<PressEventWithFeatures>;
type FacilityKind = Exclude<MapFacilityKind, "other">;

const FACILITY_COLORS: Record<FacilityKind, MarkerColors> = {
  swimming: SWIMMING_MARKER_COLORS,
  firePit: MARKER_COLORS.firePits,
  shelter: MARKER_COLORS.shelters,
};

export const AREA_DOT_COLORS: Record<FacilityKind, string> = {
  swimming: FACILITY_COLORS.swimming.fill,
  firePit: FACILITY_COLORS.firePit.fill,
  shelter: FACILITY_COLORS.shelter.fill,
};

// keep-comment: drawn bottom to top, so the last kind's points are the topmost layer
const FACILITY_KINDS: FacilityKind[] = ["swimming", "firePit", "shelter"];

const FACILITY_COUNT_KEYS = {
  swimming: "area.swimmingCount",
  firePit: "area.firePitCount",
  shelter: "area.shelterCount",
} as const satisfies Record<FacilityKind, string>;

// keep-comment: the id of the topmost layer, for a puck drawn above everything
export const AREA_TOP_LAYER = "area-shelter-points";

interface Props {
  shapes: AreaMapShapes;
  // keep-comment: left out on the area page's preview, which shows everything
  filter?: AreaMapFilter;
  // keep-comment: every trail under the finger or in a small cluster, so trails sharing a trailhead open together as on the map tab
  onTrailPress?: (identifiers: string[]) => void;
  onFacilityPress?: (name: string, coordinates: [number, number]) => void;
  // keep-comment: a cluster too big for the carousel zooms in until it breaks apart
  onZoomTo?: (center: [number, number], zoom: number) => void;
}

function pointOf(feature: GeoJSON.Feature): [number, number] {
  const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
  return [lng, lat];
}

async function handleTrailPress(
  event: PressEvent,
  sourceRef: RefObject<GeoJSONSourceRef | null>,
  onTrailPress: (identifiers: string[]) => void,
  onZoomTo?: (center: [number, number], zoom: number) => void,
) {
  event.stopPropagation();
  const features = event.nativeEvent.features ?? [];
  const cluster = features.find((feature) => feature.properties?.point_count != null);
  if (cluster) {
    const clusterId = cluster.properties?.cluster_id as number;
    const pointCount = cluster.properties?.point_count as number;
    const expansionZoom = await sourceRef.current?.getClusterExpansionZoom(clusterId);
    const action = decideClusterAction(pointCount, expansionZoom, TRAIL_CLUSTER_ACTION);
    if (action.kind === "zoom") {
      onZoomTo?.(pointOf(cluster), action.zoom);
      return;
    }
    const leaves = await sourceRef.current?.getClusterLeaves(clusterId, pointCount, 0);
    const identifiers = (leaves ?? [])
      .map((leaf) => leaf.properties?.identifier as string | undefined)
      .filter((identifier): identifier is string => !!identifier);
    if (identifiers.length > 0) onTrailPress(identifiers);
    return;
  }
  const identifiers = features
    .map((feature) => feature.properties?.identifier as string | undefined)
    .filter((identifier): identifier is string => !!identifier);
  if (identifiers.length > 0) onTrailPress([...new Set(identifiers)]);
}

async function handleFacilityPress(
  event: PressEvent,
  sourceRef: RefObject<GeoJSONSourceRef | null>,
  // keep-comment: what a place without a name is called, so tapping it still says what is there
  unnamedLabel: (count: number) => string,
  onFacilityPress?: (name: string, coordinates: [number, number]) => void,
  onZoomTo?: (center: [number, number], zoom: number) => void,
) {
  event.stopPropagation();
  const feature = event.nativeEvent.features?.[0];
  if (!feature) return;
  // keep-comment: as on the map tab, a cluster always zooms in; past CLUSTER_MAX_ZOOM nothing clusters, so every place ends up alone
  if (feature.properties?.point_count != null) {
    const expansionZoom = await sourceRef.current?.getClusterExpansionZoom(feature.properties.cluster_id as number);
    onZoomTo?.(pointOf(feature), expansionZoom ?? CLUSTER_MAX_ZOOM + 1);
    return;
  }
  const name = feature.properties?.name as string | undefined;
  onFacilityPress?.(name || unnamedLabel(1), pointOf(feature));
}

export default function AreaMapLayers({
  shapes,
  filter = SHOW_ALL_IN_AREA,
  onTrailPress,
  onFacilityPress,
  onZoomTo,
}: Props) {
  const { t } = useTranslation();
  const trailSource = useRef<GeoJSONSourceRef>(null);
  const swimmingSource = useRef<GeoJSONSourceRef>(null);
  const firePitSource = useRef<GeoJSONSourceRef>(null);
  const shelterSource = useRef<GeoJSONSourceRef>(null);
  const facilitySources = { swimming: swimmingSource, firePit: firePitSource, shelter: shelterSource };
  const interactive = !!(onTrailPress || onFacilityPress);

  const shown = useCallback(
    (feature: GeoJSON.Feature, on: boolean) =>
      on && (!filter.accessibility || feature.properties?.isAccessible === true),
    [filter.accessibility],
  );

  const trails = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({ type: "FeatureCollection", features: shapes.trails.features.filter((f) => shown(f, filter.trails)) }),
    [shapes.trails, shown, filter.trails],
  );

  const byKind = useMemo(
    () =>
      Object.fromEntries(
        FACILITY_KINDS.map((kind) => [
          kind,
          {
            type: "FeatureCollection",
            features: shapes.facilities.features.filter(
              (feature) => feature.properties?.kind === kind && shown(feature, filter[FILTER_KEY_OF_KIND[kind]]),
            ),
          } satisfies GeoJSON.FeatureCollection<GeoJSON.Point>,
        ]),
      ) as Record<FacilityKind, GeoJSON.FeatureCollection<GeoJSON.Point>>,
    [shapes.facilities, shown, filter],
  );

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
      <ClusterSource
        id="area-trails"
        data={trails}
        colors={MARKER_COLORS.trails}
        pointRadius={POINT_RADIUS}
        sourceRef={trailSource}
        {...(onTrailPress
          ? { onPress: (event: PressEvent) => void handleTrailPress(event, trailSource, onTrailPress, onZoomTo) }
          : {})}
      />
      {FACILITY_KINDS.map((kind) => (
        <ClusterSource
          key={kind}
          id={`area-${kind}`}
          data={byKind[kind]}
          colors={FACILITY_COLORS[kind]}
          pointRadius={FACILITY_POINT_RADIUS}
          sourceRef={facilitySources[kind]}
          {...(interactive
            ? {
                onPress: (event: PressEvent) =>
                  void handleFacilityPress(
                    event,
                    facilitySources[kind],
                    (count) => t(FACILITY_COUNT_KEYS[kind], { count }),
                    onFacilityPress,
                    onZoomTo,
                  ),
              }
            : {})}
        />
      ))}
    </>
  );
}
