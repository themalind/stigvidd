import { darkMapTheme } from "@/constants/theme";
import { userThemeAtom } from "@/providers/user-theme-atom";
import { useAtom } from "jotai";
import React from "react";
import { StyleProp, ViewStyle } from "react-native"
import MapView, { MapViewProps, Region } from "react-native-maps";

interface Props extends MapViewProps {
  style?: StyleProp<ViewStyle>;
  initialRegion?: Region;
  showsUserLocation?: boolean;
  children?: React.ReactNode;
}

export default function Map({
  style,
  initialRegion,
  showsUserLocation = true,
  children
}: Props) {
  const [theme] = useAtom(userThemeAtom);

  return (
    <MapView
      style={style}
      customMapStyle={theme === "dark" ? darkMapTheme : []}
      initialRegion={initialRegion}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      toolbarEnabled={false}
    >
      {children}
    </MapView>
  )
}