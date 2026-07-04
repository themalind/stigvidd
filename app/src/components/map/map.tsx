import { Map as MapLibreMap, type MapProps, type MapRef, UserLocation } from "@maplibre/maplibre-react-native";
import React, { forwardRef } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SCREEN_PADDING } from "@/constants/constants";
import { getMapStyle } from "./map-style";

type Props = Partial<Omit<MapProps, "mapStyle" | "ref" | "style">> & {
  style?: StyleProp<ViewStyle>;
  showsUserLocation?: boolean;
  children?: React.ReactNode;
};

// Shared MapLibre base map: applies the detailed MapTiler Outdoor style and
// the user-location puck, and forwards a MapRef. Callers add their own <Camera>,
// <GeoJSONSource> and <Layer> children. The logo and compass ornaments are
// hidden so the app can lay out its own controls, but the attribution button is
// kept on: MapTiler + OpenStreetMap attribution is required by the data licence
// on every screen, so it defaults on here rather than being opt-in per screen.
// It sits bottom-left (the one corner no custom control uses — the recenter
// button is bottom-right, the filter menu top-right, the back button top-left)
// and clears the safe area / tab bar. Callers can still override via props.
export default forwardRef<MapRef, Props>(function Map({ style, showsUserLocation = true, children, ...rest }, ref) {
  const insets = useSafeAreaInsets();
  return (
    <MapLibreMap
      ref={ref}
      style={style}
      mapStyle={getMapStyle()}
      logo={false}
      attribution
      attributionPosition={{ bottom: insets.bottom - 6, left: SCREEN_PADDING }}
      compass={false}
      {...rest}
    >
      {showsUserLocation && <UserLocation />}
      {children}
    </MapLibreMap>
  );
});
