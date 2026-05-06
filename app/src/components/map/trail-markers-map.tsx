import { userThemeAtom } from "@/atoms/user-theme-atom";
import { START_COORDINATE_BORAS } from "@/constants/constants";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import React, { forwardRef } from "react";
import { StyleProp, useColorScheme, ViewStyle } from "react-native";
import MapView, { Region } from "react-native-maps";
import Map from "./map";
import Marker from "./marker";
import { MapMarkerFilter } from "@/data/types";
import { getFacilityMarkers, getTrailMarkers } from "@/api/map-markers";

interface Props {
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  showsUserLocation?: boolean;
  filter: MapMarkerFilter;
  onMapReady?: () => void;
}

export default forwardRef<MapView, Props>(function TrailerMarkersMap(
  { style, initialRegion, showsUserLocation, filter, onMapReady }: Props,
  mapRef,
) {
  const userTheme = useAtomValue(userThemeAtom);
  const deviceScheme = useColorScheme();
  const isDark = (userTheme === "auto" ? deviceScheme : userTheme) === "dark";

  const { data: trails } = useQuery({
    queryKey: ["trails", "markers"],
    queryFn: getTrailMarkers,
  });

  const { data: facilities } = useQuery({
    queryKey: ["facilities", "markers"],
    queryFn: getFacilityMarkers,
  });

  const firePits = facilities?.filter((f) => f.facilityType === 1);
  const shelters = facilities?.filter((f) => f.facilityType === 2);
  const combined = facilities?.filter((f) => f.facilityType === 3);

  return (
    <Map
      ref={mapRef}
      style={style}
      initialRegion={initialRegion ?? START_COORDINATE_BORAS}
      showsUserLocation={showsUserLocation}
      {...(onMapReady !== undefined && { onMapReady })}
    >
      {filter.trails &&
        trails
          ?.filter(
            (t) =>
              t.startLatitude != null && t.startLongitude != null && (!filter.accessibility || t.isAccessible === true),
          )
          .map((trail) => (
            <Marker
              key={trail.identifier}
              coordinate={{
                latitude: Number(trail.startLatitude),
                longitude: Number(trail.startLongitude),
              }}
              title={trail.name}
              variant={isDark ? "trailDark" : "trailLight"}
            />
          ))}

      {filter.firePits &&
        firePits
          ?.filter(
            (f) => f.latitude != null && f.longitude != null && (!filter.accessibility || f.isAccessible === true),
          )
          .map((f) => (
            <Marker
              key={f.identifier}
              coordinate={{
                latitude: Number(f.latitude),
                longitude: Number(f.longitude),
              }}
              title={f.name}
              variant="firePit"
            />
          ))}

      {filter.shelters &&
        shelters
          ?.filter(
            (f) => f.latitude != null && f.longitude != null && (!filter.accessibility || f.isAccessible === true),
          )
          .map((f) => (
            <Marker
              key={f.identifier}
              coordinate={{
                latitude: Number(f.latitude),
                longitude: Number(f.longitude),
              }}
              title={f.name}
              variant="shelter"
            />
          ))}

      {(filter.shelters || filter.firePits) &&
        combined
          ?.filter(
            (f) => f.latitude != null && f.longitude != null && (!filter.accessibility || f.isAccessible === true),
          )
          .map((f) => (
            <Marker
              key={f.identifier}
              coordinate={{
                latitude: Number(f.latitude),
                longitude: Number(f.longitude),
              }}
              title={f.name}
              variant="combined"
            />
          ))}
    </Map>
  );
});
