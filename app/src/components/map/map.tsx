import { userThemeAtom } from "@/atoms/user-theme-atom";
import { useAtom } from "jotai";
import React, { forwardRef } from "react";
import { StyleProp, useColorScheme, ViewStyle } from "react-native";
import MapView, { MapViewProps, Region, UrlTile } from "react-native-maps";

interface Props extends MapViewProps {
  style?: StyleProp<ViewStyle>;
  initialRegion: Region;
  showsUserLocation?: boolean;
  children?: React.ReactNode;
}

const LIGHT_TILE_URL = "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";
const DARK_TILE_URL = "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png";

export default forwardRef<MapView, Props>(function Map(
  { style, initialRegion, showsUserLocation = true, children, ...rest },
  mapRef,
) {
  const [theme] = useAtom(userThemeAtom);
  const deviceScheme = useColorScheme();
  const isDark = (theme === "auto" ? deviceScheme : theme) === "dark";

  return (
    <MapView
      ref={mapRef}
      style={style}
      mapType="none"
      initialRegion={initialRegion}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      {...rest}
    >
      <UrlTile urlTemplate={isDark ? DARK_TILE_URL : LIGHT_TILE_URL} maximumZ={19} flipY={false} />
      {children}
    </MapView>
  );
});
