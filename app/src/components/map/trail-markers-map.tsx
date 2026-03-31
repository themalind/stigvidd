import { getTrailMarkers } from "@/api/trails";
import { userThemeAtom } from "@/atoms/user-theme-atom";
import { START_COORDINATE_BORAS } from "@/constants/constants";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import React from "react";
import { StyleProp, useColorScheme, ViewStyle } from "react-native";
import { Region } from "react-native-maps";
import Map from "./map";
import Marker from "./marker";

interface Props {
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  showsUserLocation?: boolean;
  onMapReady?: () => void;
}

export default function TrailMarkersMap({ style, initialRegion, showsUserLocation, onMapReady }: Props) {
  const userTheme = useAtomValue(userThemeAtom);
  const deviceScheme = useColorScheme();
  const isDark = (userTheme === "auto" ? deviceScheme : userTheme) === "dark";

  const { data: trails } = useQuery({
    queryKey: ["trails", "markers"],
    queryFn: getTrailMarkers,
  });

  return (
    <Map
      style={style}
      initialRegion={initialRegion ?? START_COORDINATE_BORAS}
      showsUserLocation={showsUserLocation}
      {...(onMapReady !== undefined && { onMapReady })}
    >
      {trails
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
}
