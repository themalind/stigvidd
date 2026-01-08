import { nightMapTheme, retroMapTheme } from "@/constants/theme";
import { userThemeAtom } from "@/providers/user-theme-atom";
import * as Location from "expo-location";
import { useAtom } from "jotai";
import React, { useEffect } from "react";
import { StyleProp, useColorScheme, ViewStyle } from "react-native"
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
  const deviceScheme = useColorScheme();
  let mapStyle = "dark";

  if (theme === "auto") {
    mapStyle = deviceScheme === "light" ? "light" : "dark";
  }
  
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if ( status !== "granted" ) return;
    })();
  }, []);

  return (
    <MapView
      style={style}
      customMapStyle={mapStyle === "dark" ? nightMapTheme : retroMapTheme}
      initialRegion={initialRegion}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      toolbarEnabled={false}
    >
      {children}
    </MapView>
  )
}
