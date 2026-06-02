import React, { forwardRef } from "react";
import { StyleProp, ViewStyle } from "react-native";
import MapView, { MapViewProps, Region, UrlTile } from "react-native-maps";
import { useTheme } from "react-native-paper";

interface Props extends MapViewProps {
  style?: StyleProp<ViewStyle>;
  initialRegion: Region;
  showsUserLocation?: boolean;
  children?: React.ReactNode;
}

const TILE_URL = "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";

export default forwardRef<MapView, Props>(function Map(
  { style, initialRegion, showsUserLocation = true, children, ...rest },
  mapRef,
) {
  const theme = useTheme();
  return (
    <MapView
      ref={mapRef}
      style={[{ backgroundColor: theme.colors.background }, style]}
      mapType="none"
      initialRegion={initialRegion}
      showsUserLocation={showsUserLocation}
      userLocationAnnotationTitle=""
      showsMyLocationButton={false}
      toolbarEnabled={false}
      {...rest}
    >
      <UrlTile urlTemplate={TILE_URL} maximumZ={19} flipY={false} />
      {children}
    </MapView>
  );
});
