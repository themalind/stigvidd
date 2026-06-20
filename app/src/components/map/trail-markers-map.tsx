import { getFacilityMarkers, getTrailMarkers } from "@/api/map-markers";
import { BORDER_RADIUS, START_COORDINATE_BORAS } from "@/constants/constants";
import { MapMarkerFilter } from "@/data/types";
import { featureCollectionFromFacilities, featureCollectionFromMarkers } from "@/utils/geojson";
import {
  Camera,
  type CameraRef,
  type FilterSpecification,
  GeoJSONSource,
  type GeoJSONSourceRef,
  Layer,
  Marker,
  type PressEventWithFeatures,
} from "@maplibre/maplibre-react-native";
import { useQuery } from "@tanstack/react-query";
import { RefObject, useCallback, useMemo, useRef, useState } from "react";
import { NativeSyntheticEvent, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Text, useTheme } from "react-native-paper";
import Map from "./map";
import { MARKER_COLORS } from "./marker-styles";

interface SelectedFacility {
  name: string;
  coordinates: [number, number];
}

interface Props {
  style?: StyleProp<ViewStyle>;
  filter: MapMarkerFilter;
  cameraRef: RefObject<CameraRef | null>;
  onClusterOpen: (identifiers: string[]) => void;
  onMapPress?: () => void;
  onMapReady?: () => void;
}

const BORAS_CENTER: [number, number] = [START_COORDINATE_BORAS.longitude, START_COORDINATE_BORAS.latitude];
// Keep points clustered up to a high zoom so overlapping trailheads stay a single
// tappable cluster instead of un-tappable stacked individual pins.
const CLUSTER_MAX_ZOOM = 16;
// Small clusters open the carousel directly — they're usually trails sharing a
// trailhead that won't separate usefully by zooming. Larger, genuinely separable
// clusters zoom in to break apart instead.
const CAROUSEL_MAX_COUNT = 10;

const HAS_COUNT: FilterSpecification = ["has", "point_count"];
const NO_COUNT: FilterSpecification = ["!", ["has", "point_count"]];

export default function TrailMarkersMap({
  style,
  filter,
  cameraRef,
  onClusterOpen,
  onMapPress,
  onMapReady,
}: Props) {
  const theme = useTheme();
  const trailSourceRef = useRef<GeoJSONSourceRef>(null);
  // Facilities have no detail screen yet, so a tap just shows the name in a bubble.
  const [selectedFacility, setSelectedFacility] = useState<SelectedFacility | null>(null);

  const handleMapPress = useCallback(() => {
    setSelectedFacility(null);
    onMapPress?.();
  }, [onMapPress]);

  const { data: trailMarkers } = useQuery({
    queryKey: ["trails", "markers"],
    queryFn: getTrailMarkers,
    enabled: filter.trails,
    staleTime: 5 * 60 * 1000,
  });

  const { data: facilities } = useQuery({
    queryKey: ["facilities", "markers"],
    queryFn: getFacilityMarkers,
    enabled: filter.firePits || filter.shelters,
    staleTime: 5 * 60 * 1000,
  });

  const trailFC = useMemo(() => {
    const markers = (trailMarkers ?? []).filter((m) => !filter.accessibility || m.isAccessible);
    return featureCollectionFromMarkers(markers);
  }, [trailMarkers, filter.accessibility]);

  const firePitFC = useMemo(() => {
    const items = (facilities ?? []).filter(
      (f) => (f.facilityType === 1 || f.facilityType === 3) && (!filter.accessibility || f.isAccessible),
    );
    return featureCollectionFromFacilities(items);
  }, [facilities, filter.accessibility]);

  const shelterFC = useMemo(() => {
    const items = (facilities ?? []).filter(
      (f) => (f.facilityType === 2 || f.facilityType === 3) && (!filter.accessibility || f.isAccessible),
    );
    return featureCollectionFromFacilities(items);
  }, [facilities, filter.accessibility]);

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
        // A cluster that only "expands" beyond CLUSTER_MAX_ZOOM is effectively
        // co-located — zooming won't separate it. Zoom in only for large clusters
        // that genuinely break apart; otherwise open the carousel.
        const separable = expansionZoom != null && expansionZoom <= CLUSTER_MAX_ZOOM;
        if (pointCount > CAROUSEL_MAX_COUNT && separable && expansionZoom != null) {
          cameraRef.current?.flyTo({ center: [lng, lat], zoom: expansionZoom, duration: 500 });
          return;
        }

        const leaves = await trailSourceRef.current?.getClusterLeaves(clusterId, pointCount, 0);
        const ids = (leaves ?? [])
          .map((leaf) => leaf.properties?.identifier as string | undefined)
          .filter((id): id is string => !!id);
        if (ids.length > 0) onClusterOpen(ids);
        return;
      }

      if (props.identifier) onClusterOpen([props.identifier as string]);
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
      >
        <Camera ref={cameraRef} initialViewState={{ center: BORAS_CENTER, zoom: 9.5 }} />

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
                "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26],
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
                "circle-radius": 9,
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
