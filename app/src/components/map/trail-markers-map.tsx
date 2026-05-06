import { getTrailMarkers } from "@/api/trails";
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
          ?.filter((t) => t.startLatitude != null && t.startLongitude != null)
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
    </Map>
  );
});
