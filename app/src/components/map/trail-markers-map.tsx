import { getFacilityMarkers, getTrailMarkers } from "@/api/map-markers";
import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { BORDER_RADIUS, START_COORDINATE_BORAS } from "@/constants/constants";
import { FacilityType, hasFacilityType, MapMarkerFilter } from "@/data/types";
import { type ClusterActionConfig, decideClusterAction } from "@/utils/cluster-action";
import { featureCollectionFromFacilities, featureCollectionFromMarkers, pointFeatureFromPosition } from "@/utils/geojson";
import {
  Camera,
  type CameraRef,
  type FilterSpecification,
  GeoJSONSource,
  type GeoJSONSourceRef,
  type InitialViewState,
  Layer,
  Marker,
  type PressEventWithFeatures,
  type ViewStateChangeEvent,
} from "@maplibre/maplibre-react-native";
import { useQuery } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NativeSyntheticEvent, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Text, useTheme } from "react-native-paper";
import Map from "./map";
import { HIGHLIGHT_MARKER_COLORS, MARKER_COLORS } from "./marker-styles";

interface SelectedFacility {
  name: string;
  coordinates: [number, number];
}

interface Props {
  style?: StyleProp<ViewStyle>;
  filter: MapMarkerFilter;
  cameraRef: RefObject<CameraRef | null>;
  // The tapped cluster/trail to ring on the map while its carousel is open.
  highlight?: MapHighlight | null;
  // Seeds the camera on mount. The screen remembers the last view here so the map
  // reopens where the user left it (instead of resetting) after navigating away.
  initialViewState?: InitialViewState;
  // expansionZoom is the level at which this cluster breaks apart, so the screen can
  // dismiss the carousel once a zoom moves out of the range where the cluster holds
  // together. Omitted for a single trail, which never splits or merges.
  onClusterOpen: (identifiers: string[], highlight: MapHighlight, expansionZoom?: number) => void;
  onRegionDidChange?: (event: NativeSyntheticEvent<ViewStateChangeEvent>) => void;
  onMapPress?: () => void;
  onMapReady?: () => void;
}

const BORAS_CENTER: [number, number] = [START_COORDINATE_BORAS.longitude, START_COORDINATE_BORAS.latitude];
// Where the camera opens the first time, before any view has been remembered.
const DEFAULT_VIEW_STATE: InitialViewState = { center: BORAS_CENTER, zoom: 9.5 };
// Keep points clustered up to a high zoom so overlapping trailheads stay a single
// tappable cluster instead of un-tappable stacked individual pins.
const CLUSTER_MAX_ZOOM = 16;
// Small clusters open the carousel directly — they're usually trails sharing a
// trailhead that won't separate usefully by zooming. Larger, genuinely separable
// clusters zoom in to break apart instead.
const CAROUSEL_MAX_COUNT = 10;

const CLUSTER_ACTION_CONFIG: ClusterActionConfig = {
  clusterMaxZoom: CLUSTER_MAX_ZOOM,
  carouselMaxCount: CAROUSEL_MAX_COUNT,
};

const HAS_COUNT: FilterSpecification = ["has", "point_count"];
const NO_COUNT: FilterSpecification = ["!", ["has", "point_count"]];

// Circle radii for the trail source's rendered layers. Kept as named constants so
// the selection ring can be sized from the same numbers and always sit just outside
// whatever was tapped (a point or a cluster of any size).
const POINT_RADIUS = 9;
const CLUSTER_RADIUS_BASE = 16;
const CLUSTER_RADIUS_MED = 20;
const CLUSTER_RADIUS_LARGE = 26;
const CLUSTER_COUNT_MED = 10;
const CLUSTER_COUNT_LARGE = 50;
// Gap between the marker edge and the selection ring.
const RING_GAP = 5;

// The rendered radius of a tapped feature — null pointCount means a single trail
// point; otherwise mirror the cluster circle-radius step below.
function markerRadius(pointCount: number | null): number {
  if (pointCount == null) return POINT_RADIUS;
  if (pointCount >= CLUSTER_COUNT_LARGE) return CLUSTER_RADIUS_LARGE;
  if (pointCount >= CLUSTER_COUNT_MED) return CLUSTER_RADIUS_MED;
  return CLUSTER_RADIUS_BASE;
}

// The tapped cluster/trail to ring on the map while its carousel is open. The
// radius sizes the ring to hug that specific marker.
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
  onClusterOpen,
  onRegionDidChange,
  onMapPress,
  onMapReady,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const showError = useSetAtom(showErrorAtom);
  const trailSourceRef = useRef<GeoJSONSourceRef>(null);
  // Facilities have no detail screen yet, so a tap just shows the name in a bubble.
  const [selectedFacility, setSelectedFacility] = useState<SelectedFacility | null>(null);

  const handleMapPress = useCallback(() => {
    setSelectedFacility(null);
    onMapPress?.();
  }, [onMapPress]);

  const { data: trailMarkers, isError: trailMarkersError } = useQuery({
    queryKey: ["trails", "markers"],
    queryFn: getTrailMarkers,
    enabled: filter.trails,
    staleTime: 5 * 60 * 1000,
  });

  const { data: facilities, isError: facilitiesError } = useQuery({
    queryKey: ["facilities", "markers"],
    queryFn: getFacilityMarkers,
    enabled: filter.firePits || filter.shelters,
    staleTime: 5 * 60 * 1000,
  });

  // Surface load failures without blanking the map: keep whatever tiles/markers
  // are already shown and report the error via the global snackbar.
  useEffect(() => {
    if (trailMarkersError || facilitiesError) {
      showError(t("map.loadError"));
    }
  }, [trailMarkersError, facilitiesError, showError, t]);

  const trailFC = useMemo(() => {
    const markers = (trailMarkers ?? []).filter((m) => !filter.accessibility || m.isAccessible);
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

  // A thin ring around the tapped cluster/trail while its carousel is open. Set once
  // on tap (not per swipe) so co-located trails — whose ring would never visibly
  // move — don't make the map look like it's stuttering. The radius travels in the
  // feature so the ring layer can hug markers of any size.
  const highlightFC = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
    if (!highlight) return { type: "FeatureCollection", features: [] };
    const feature = pointFeatureFromPosition(highlight.coordinate);
    feature.properties = { radius: highlight.radius + RING_GAP };
    return { type: "FeatureCollection", features: [feature] };
  }, [highlight]);

  const handleTrailPress = useCallback(
    async (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
      event.stopPropagation();
      setSelectedFacility(null);
      const feature = event.nativeEvent.features?.[0];
      if (!feature) return;
      const props = feature.properties ?? {};

      if (props.point_count != null) {
        const clusterId = props.cluster_id as number;
        const pointCount = props.point_count as number;
        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;

        const expansionZoom = await trailSourceRef.current?.getClusterExpansionZoom(clusterId);
        const action = decideClusterAction(pointCount, expansionZoom, CLUSTER_ACTION_CONFIG);
        if (action.kind === "zoom") {
          cameraRef.current?.flyTo({ center: [lng, lat], zoom: action.zoom, duration: 500 });
          return;
        }

        const leaves = await trailSourceRef.current?.getClusterLeaves(clusterId, pointCount, 0);
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
    [cameraRef, onClusterOpen],
  );

  const handleFacilityPress = useCallback((event: NativeSyntheticEvent<PressEventWithFeatures>) => {
    // Stop the press from dismissing the map, then show the facility's name.
    event.stopPropagation();
    const feature = event.nativeEvent.features?.[0];
    if (!feature) return;
    const name = feature.properties?.name as string | undefined;
    const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
    if (name) setSelectedFacility({ name, coordinates });
  }, []);

  return (
    <View style={style}>
      <Map
        style={StyleSheet.absoluteFill}
        showsUserLocation
        onPress={handleMapPress}
        onDidFinishLoadingMap={onMapReady}
        onRegionDidChange={onRegionDidChange}
      >
        <Camera ref={cameraRef} initialViewState={initialViewState ?? DEFAULT_VIEW_STATE} />

        {selectedFacility && (
          <Marker lngLat={selectedFacility.coordinates} anchor="bottom" offset={[0, -8]}>
            <View style={[s.callout, { backgroundColor: theme.colors.elevation.level3 }]}>
              <Text style={[s.calloutText, { color: theme.colors.onSurface }]} numberOfLines={2}>
                {selectedFacility.name}
              </Text>
            </View>
          </Marker>
        )}

        {filter.trails && (
          <GeoJSONSource
            id="trails"
            ref={trailSourceRef}
            data={trailFC}
            cluster
            clusterRadius={60}
            clusterMaxZoom={CLUSTER_MAX_ZOOM}
            onPress={handleTrailPress}
          >
            <Layer
              type="circle"
              id="trail-clusters"
              filter={HAS_COUNT}
              paint={{
                "circle-color": MARKER_COLORS.trails.fill,
                "circle-radius": [
                  "step",
                  ["get", "point_count"],
                  CLUSTER_RADIUS_BASE,
                  CLUSTER_COUNT_MED,
                  CLUSTER_RADIUS_MED,
                  CLUSTER_COUNT_LARGE,
                  CLUSTER_RADIUS_LARGE,
                ],
                "circle-stroke-width": 2,
                "circle-stroke-color": MARKER_COLORS.trails.stroke,
              }}
            />
            <Layer
              type="symbol"
              id="trail-cluster-count"
              filter={HAS_COUNT}
              layout={{
                "text-field": ["get", "point_count_abbreviated"],
                "text-font": ["Noto Sans Regular"],
                "text-size": 12,
              }}
              paint={{ "text-color": MARKER_COLORS.trails.stroke }}
            />
            <Layer
              type="circle"
              id="trail-points"
              filter={NO_COUNT}
              paint={{
                "circle-color": MARKER_COLORS.trails.fill,
                "circle-radius": POINT_RADIUS,
                "circle-stroke-width": 2,
                "circle-stroke-color": MARKER_COLORS.trails.stroke,
              }}
            />
          </GeoJSONSource>
        )}

        {filter.firePits && (
          <GeoJSONSource id="firepits" data={firePitFC} onPress={handleFacilityPress}>
            <Layer
              type="circle"
              id="firepit-points"
              paint={{
                "circle-color": MARKER_COLORS.firePits.fill,
                "circle-radius": 6,
                "circle-stroke-width": 2,
                "circle-stroke-color": MARKER_COLORS.firePits.stroke,
              }}
            />
          </GeoJSONSource>
        )}

        {filter.shelters && (
          <GeoJSONSource id="shelters" data={shelterFC} onPress={handleFacilityPress}>
            <Layer
              type="circle"
              id="shelter-points"
              paint={{
                "circle-color": MARKER_COLORS.shelters.fill,
                "circle-radius": 6,
                "circle-stroke-width": 2,
                "circle-stroke-color": MARKER_COLORS.shelters.stroke,
              }}
            />
          </GeoJSONSource>
        )}

        {/* Declared last so the selection ring draws above every trail/cluster/
            facility layer. It's a stroke-only ring sized just outside the tapped
            marker, so it hugs the selection without covering a cluster's count.
            Built as a plain circle layer (never a view-hosted <Marker>), the
            iOS/Fabric-safe path used throughout the map. */}
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
    </View>
  );
}

const s = StyleSheet.create({
  callout: {
    maxWidth: 220,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS,
  },
  calloutText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
