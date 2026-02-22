import { userThemeAtom } from "@/atoms/user-theme-atom";
import { nightMapTheme, retroMapTheme } from "@/constants/theme";
import { useAtom } from "jotai";
import React, { forwardRef } from "react";
import { StyleProp, useColorScheme, ViewStyle } from "react-native";
import MapView, { MapViewProps, Region } from "react-native-maps";

interface Props extends MapViewProps {
  style?: StyleProp<ViewStyle>;
  initialRegion: Region;
  showsUserLocation?: boolean;
  children?: React.ReactNode;
}

export default forwardRef<MapView, Props>(function Map(
  { style, initialRegion, showsUserLocation = true, children, ...rest },
  ref,
) {
  const [theme] = useAtom(userThemeAtom);
  const deviceScheme = useColorScheme();
  let mapStyle = "dark";

  if (theme === "auto") {
    mapStyle = deviceScheme === "light" ? "light" : "dark";
  }

  if (theme === "light") {
    mapStyle = "light";
  }

  return (
    <MapView
      ref={ref}
      style={style}
      customMapStyle={mapStyle === "dark" ? nightMapTheme : retroMapTheme}
      initialRegion={initialRegion}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      {...rest}
    >
      {children}
    </MapView>
  );
});
