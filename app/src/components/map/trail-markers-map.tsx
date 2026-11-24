// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getFacilityMarkers, getTrailMarkers } from "@/api/map-markers";
import { useUserLocation } from "@/hooks/location/useUserLocation";
import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { BORDER_RADIUS, START_COORDINATE_BORAS } from "@/constants/constants";
import { FacilityType, hasFacilityType, MapMarkerFilter } from "@/data/types";
import { decideClusterAction } from "@/components/map/cluster-action";
import ClusterSource, {
  CLUSTER_MAX_ZOOM,
  FACILITY_POINT_RADIUS,
  markerRadius,
  POINT_RADIUS,
  TRAIL_CLUSTER_ACTION,
} from "@/components/map/cluster-source";
import {
  featureCollectionFromFacilities,
  featureCollectionFromMarkers,
  pointFeatureFromPosition,
} from "@/utils/geo/geojson";
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  type GeoJSONSourceRef,
  type InitialViewState,
  Layer,
  type MapProps,
  type PressEventWithFeatures,
  useCurrentPosition,
  type ViewStateChangeEvent,
} from "@maplibre/maplibre-react-native";
import { TRAIL_MARKERS_STALE_TIME } from "@/constants/cache";
import { onlineManager, useQuery } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NativeSyntheticEvent, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";
import Map from "./map";
import MapNameBubble from "./map-name-bubble";
import { HIGHLIGHT_MARKER_COLORS, MARKER_COLORS, SWIMMING_MARKER_COLORS } from "./marker-styles";

type FacilityTypeValue = (typeof FacilityType)[keyof typeof FacilityType];

interface SelectedFacility {
  name: string;
  coordinates: [number, number];
  // keep-comment: every kind the place is, so its bubble stays while any of its pins is still shown
  facilityType: number;
  isAccessible: boolean;
}

interface Props {
  style?: StyleProp<ViewStyle>;
  filter: MapMarkerFilter;
  cameraRef: RefObject<CameraRef | null>;
  highlight?: MapHighlight | null;
  initialViewState?: InitialViewState;
  attributionPosition?: MapProps["attributionPosition"];
  // keep-comment: expansionZoom is where the cluster splits; a single trail has none
  onClusterOpen: (identifiers: string[], highlight: MapHighlight, expansionZoom?: number) => void;
  onRegionDidChange?: (event: NativeSyntheticEvent<ViewStateChangeEvent>) => void;
  // keep-comment: any press that opens no cards: the map itself, a zooming cluster or a facility pin
  onDismiss?: () => void;
  onMapReady?: () => void;
  // keep-comment: false while covered, since each subscriber keeps MapLibre's location engine running
  tracksUser?: boolean;
}

const BORAS_CENTER: [number, number] = [START_COORDINATE_BORAS.longitude, START_COORDINATE_BORAS.latitude];
const DEFAULT_VIEW_STATE: InitialViewState = { center: BORAS_CENTER, zoom: 9.5 };
const RING_GAP = 5;

export interface MapHighlight {
  coordinate: [number, number];
  radius: number;
}

export default function TrailMarkersMap({
  style,
  filter,
  cameraRef,
  highlight,
  initialViewState,
  attributionPosition,
  onClusterOpen,
  onRegionDidChange,
  onDismiss,
  onMapReady,
  tracksUser = true,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const showError = useSetAtom(showErrorAtom);
  const trailSourceRef = useRef<GeoJSONSourceRef>(null);
  const contributionSourceRef = useRef<GeoJSONSourceRef>(null);

  // useCurrentPosition shares the puck's engine, so it fills exactly when the puck appears. keep-comment: hidden coupling
  // The pill waits only for a real fix; with permission denied none ever comes. keep-comment: why the fallback check
  const { data: userLocation } = useUserLocation();
  const currentPosition = useCurrentPosition({ enabled: tracksUser });
  const isLocating = tracksUser && !!userLocation && !userLocation.isFallback && !currentPosition;
  const firePitSourceRef = useRef<GeoJSONSourceRef>(null);
  const shelterSourceRef = useRef<GeoJSONSourceRef>(null);
  const swimmingSourceRef = useRef<GeoJSONSourceRef>(null);
  const [selectedFacility, setSelectedFacility] = useState<SelectedFacility | null>(null);

  const handleMapPress = useCallback(() => {
    setSelectedFacility(null);
    onDismiss?.();
  }, [onDismiss]);

  // keep-comment: the bubble goes with its pin when a filter hides it, or it floats over nothing
  if (selectedFacility) {
    const kinds = selectedFacility.facilityType;
    const typeVisible =
      (filter.firePits && hasFacilityType(kinds, FacilityType.FirePit)) ||
      (filter.shelters && hasFacilityType(kinds, FacilityType.Shelter)) ||
      (filter.swimming && hasFacilityType(kinds, FacilityType.SwimmingArea));
    const accessibilityVisible = !filter.accessibility || selectedFacility.isAccessible;
    if (!typeVisible || !accessibilityVisible) setSelectedFacility(null);
  }

  const { data: trailMarkers, isError: trailMarkersError } = useQuery({
    queryKey: ["trails", "markers"],
    queryFn: getTrailMarkers,
    enabled: filter.trails || filter.contributions,
    staleTime: TRAIL_MARKERS_STALE_TIME,
  });

  const { data: facilities, isError: facilitiesError } = useQuery({
    queryKey: ["facilities", "markers"],
    queryFn: getFacilityMarkers,
    enabled: filter.firePits || filter.shelters || filter.swimming,
    staleTime: TRAIL_MARKERS_STALE_TIME,
  });

  useEffect(() => {
    // Read, not subscribed: a reconnect must not replay a failure the offline notice covered. keep-comment: race
    if ((trailMarkersError || facilitiesError) && onlineManager.isOnline()) {
      showError(t("map.loadError"));
    }
  }, [trailMarkersError, facilitiesError, showError, t]);

  const trailFC = useMemo(() => {
    const markers = (trailMarkers ?? []).filter((m) => !m.isContribution && (!filter.accessibility || m.isAccessible));
    return featureCollectionFromMarkers(markers);
  }, [trailMarkers, filter.accessibility]);

  const contributionFC = useMemo(() => {
    const markers = (trailMarkers ?? []).filter((m) => m.isContribution && (!filter.accessibility || m.isAccessible));
    return featureCollectionFromMarkers(markers);
  }, [trailMarkers, filter.accessibility]);

  const firePitFC = useMemo(() => {
    const items = (facilities ?? []).filter(
      (f) => hasFacilityType(f.facilityType, FacilityType.FirePit) && (!filter.accessibility || f.isAccessible),
    );
    return featureCollectionFromFacilities(items);
  }, [facilities, filter.accessibility]);

  const shelterFC = useMemo(() => {
    const items = (facilities ?? []).filter(
      (f) => hasFacilityType(f.facilityType, FacilityType.Shelter) && (!filter.accessibility || f.isAccessible),
    );
    return featureCollectionFromFacilities(items);
  }, [facilities, filter.accessibility]);

  const swimmingFC = useMemo(() => {
    const items = (facilities ?? []).filter(
      (f) => hasFacilityType(f.facilityType, FacilityType.SwimmingArea) && (!filter.accessibility || f.isAccessible),
    );
    return featureCollectionFromFacilities(items);
  }, [facilities, filter.accessibility]);

  const highlightFC = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
    if (!highlight) return { type: "FeatureCollection", features: [] };
    const feature = pointFeatureFromPosition(highlight.coordinate);
    feature.properties = { radius: highlight.radius + RING_GAP };
    return { type: "FeatureCollection", features: [feature] };
  }, [highlight]);

  const handleTrailPress = useCallback(
    async (event: NativeSyntheticEvent<PressEventWithFeatures>, sourceRef: RefObject<GeoJSONSourceRef | null>) => {
      event.stopPropagation();
      setSelectedFacility(null);
      const feature = event.nativeEvent.features?.[0];
      if (!feature) return;
      const props = feature.properties ?? {};

      if (props.point_count != null) {
        const clusterId = props.cluster_id as number;
        const pointCount = props.point_count as number;
        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;

        const expansionZoom = await sourceRef.current?.getClusterExpansionZoom(clusterId);
        const action = decideClusterAction(pointCount, expansionZoom, TRAIL_CLUSTER_ACTION);
        if (action.kind === "zoom") {
          onDismiss?.();
          cameraRef.current?.flyTo({ center: [lng, lat], zoom: action.zoom, duration: 500 });
          return;
        }

        const leaves = await sourceRef.current?.getClusterLeaves(clusterId, pointCount, 0);
        const ids = (leaves ?? [])
          .map((leaf) => leaf.properties?.identifier as string | undefined)
          .filter((id): id is string => !!id);
        if (ids.length > 0) {
          onClusterOpen(ids, { coordinate: [lng, lat], radius: markerRadius(pointCount) }, expansionZoom ?? undefined);
        }
        return;
      }

      if (props.identifier) {
        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
        onClusterOpen([props.identifier as string], { coordinate: [lng, lat], radius: markerRadius(null) });
      }
    },
    [cameraRef, onClusterOpen, onDismiss],
  );

  const handleFacilityPress = useCallback(
    (type: FacilityTypeValue) =>
      async (event: NativeSyntheticEvent<PressEventWithFeatures>, sourceRef: RefObject<GeoJSONSourceRef | null>) => {
        event.stopPropagation();
        const feature = event.nativeEvent.features?.[0];
        if (!feature) return;
        const props = feature.properties ?? {};
        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
        onDismiss?.();

        if (props.point_count != null) {
          setSelectedFacility(null);
          const clusterId = props.cluster_id as number;
          const expansionZoom = await sourceRef.current?.getClusterExpansionZoom(clusterId);
          cameraRef.current?.flyTo({ center: [lng, lat], zoom: expansionZoom ?? CLUSTER_MAX_ZOOM, duration: 500 });
          return;
        }

        const name = props.name as string | undefined;
        const isAccessible = Boolean(props.isAccessible);
        const facilityType = typeof props.facilityType === "number" ? props.facilityType : type;
        if (name) setSelectedFacility({ name, coordinates: [lng, lat], facilityType, isAccessible });
      },
    [cameraRef, onDismiss],
  );

  return (
    <View style={style}>
      <Map
        style={StyleSheet.absoluteFill}
        showsUserLocation={tracksUser}
        // keep-comment: an undefined key would override Map's default instead of falling back to it
        {...(attributionPosition ? { attributionPosition } : {})}
        onPress={handleMapPress}
        onDidFinishLoadingMap={onMapReady}
        onRegionDidChange={onRegionDidChange}
      >
        <Camera ref={cameraRef} initialViewState={initialViewState ?? DEFAULT_VIEW_STATE} />

        {selectedFacility && <MapNameBubble name={selectedFacility.name} coordinates={selectedFacility.coordinates} />}

        {filter.trails && (
          <ClusterSource
            id="trails"
            sourceRef={trailSourceRef}
            data={trailFC}
            colors={MARKER_COLORS.trails}
            pointRadius={POINT_RADIUS}
            onPress={handleTrailPress}
          />
        )}

        {filter.contributions && (
          <ClusterSource
            id="contributions"
            sourceRef={contributionSourceRef}
            data={contributionFC}
            colors={MARKER_COLORS.contributions}
            pointRadius={POINT_RADIUS}
            onPress={handleTrailPress}
          />
        )}

        {filter.swimming && (
          <ClusterSource
            id="swimming"
            sourceRef={swimmingSourceRef}
            data={swimmingFC}
            colors={SWIMMING_MARKER_COLORS}
            pointRadius={FACILITY_POINT_RADIUS}
            onPress={handleFacilityPress(FacilityType.SwimmingArea)}
          />
        )}

        {filter.firePits && (
          <ClusterSource
            id="firepits"
            sourceRef={firePitSourceRef}
            data={firePitFC}
            colors={MARKER_COLORS.firePits}
            pointRadius={FACILITY_POINT_RADIUS}
            onPress={handleFacilityPress(FacilityType.FirePit)}
          />
        )}

        {filter.shelters && (
          <ClusterSource
            id="shelters"
            sourceRef={shelterSourceRef}
            data={shelterFC}
            colors={MARKER_COLORS.shelters}
            pointRadius={FACILITY_POINT_RADIUS}
            onPress={handleFacilityPress(FacilityType.Shelter)}
          />
        )}

        {/* keep-comment: last, so the ring draws above every marker layer */}
        {/* keep-comment: a circle layer, never a view-hosted <Marker>, which is unsafe on iOS/Fabric */}
        {highlightFC.features.length > 0 && (
          <GeoJSONSource id="trail-highlight" data={highlightFC}>
            <Layer
              type="circle"
              id="trail-highlight-ring"
              paint={{
                "circle-radius": ["get", "radius"],
                "circle-opacity": 0,
                "circle-stroke-width": 3,
                "circle-stroke-color": HIGHLIGHT_MARKER_COLORS.ring,
              }}
            />
          </GeoJSONSource>
        )}
      </Map>

      {isLocating && (
        <View style={[s.locatingPill, { backgroundColor: theme.colors.elevation.level3 }]} pointerEvents="none">
          <ActivityIndicator size={16} color={theme.colors.onSurface} />
          <Text variant="bodySmall" style={{ color: theme.colors.onSurface }}>
            {t("map.locating")}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  locatingPill: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS,
  },
});
