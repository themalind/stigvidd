import { Map as MapLibreMap, type MapProps, type MapRef, UserLocation } from "@maplibre/maplibre-react-native";
import React, { forwardRef } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { getMapStyle } from "./map-style";

type Props = Partial<Omit<MapProps, "mapStyle" | "ref" | "style">> & {
  style?: StyleProp<ViewStyle>;
  showsUserLocation?: boolean;
  children?: React.ReactNode;
};

// Shared MapLibre base map: applies the detailed Thunderforest outdoor style and
// the user-location puck, and forwards a MapRef. Callers add their own <Camera>,
// <GeoJSONSource> and <Layer> children. Ornaments (logo, attribution, compass)
// are hidden so the app can lay out its own controls.
export default forwardRef<MapRef, Props>(function Map({ style, showsUserLocation = true, children, ...rest }, ref) {
  return (
    <MapLibreMap
      ref={ref}
      style={style}
      mapStyle={getMapStyle()}
      logo={false}
      attribution={false}
      compass={false}
      {...rest}
    >
      {showsUserLocation && <UserLocation />}
      {children}
    </MapLibreMap>
  );
});
